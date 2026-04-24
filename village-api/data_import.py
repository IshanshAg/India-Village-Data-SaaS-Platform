import pandas as pd
import psycopg2
import os
import signal
from dotenv import load_dotenv
load_dotenv()
# DB connection
conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    port=os.getenv("DB_PORT")
)

cursor = conn.cursor()

# Load Excel
folder_path = "dataset"
all_data = []

files = os.listdir(folder_path)
print("📁 Total files found:", len(files))

REQUIRED_COLUMNS = {
    'MDDS STC', 'STATE NAME', 'MDDS DTC', 'DISTRICT NAME',
    'MDDS Sub_DT', 'SUB-DISTRICT NAME', 'MDDS PLCN', 'Area Name'
}

for file in files:
    # Skip junk files
    if file.startswith("._"):
        continue

    file_path = os.path.join(folder_path, file)

    try:
        if file.endswith(".xls"):
            df = pd.read_excel(file_path, engine="xlrd")
        elif file.endswith(".xlsx"):
            df = pd.read_excel(file_path, engine="openpyxl")
        elif file.endswith(".ods"):
            # ODS files can hang — use subprocess with timeout to protect main process
            import subprocess, sys, json, tempfile

            helper_script = f"""
import pandas as pd, json, sys
try:
    df = pd.read_excel(r"{file_path}", engine="odf")
    cols = list(df.columns)
    # Only keep required columns if present
    required = {list(REQUIRED_COLUMNS)}
    available = [c for c in required if c in cols]
    df = df[available]
    tmp = r"{file_path}.tmp.json"
    df.to_json(tmp, orient="records", force_ascii=False)
    print("OK:" + tmp)
except Exception as e:
    print("ERR:" + str(e))
"""
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tf:
                tf.write(helper_script)
                helper_path = tf.name

            result = subprocess.run(
                [sys.executable, helper_path],
                capture_output=True, text=True, timeout=120
            )
            os.unlink(helper_path)

            output = result.stdout.strip()
            if output.startswith("OK:"):
                tmp_json = output[3:]
                df = pd.read_json(tmp_json, orient="records")
                os.unlink(tmp_json)
            else:
                err = output.replace("ERR:", "") or result.stderr
                print(f"⚠️  Skipping ODS {file}: {err}")
                continue
        else:
            continue

        # Validate required columns exist
        missing = REQUIRED_COLUMNS - set(df.columns)
        if missing:
            print(f"⚠️  Skipping {file}: missing columns {missing}")
            continue

        print(f"✅ Loaded: {file} | Rows: {len(df)}")
        all_data.append(df)

    except subprocess.TimeoutExpired:
        print(f"⏱️  Timeout reading {file} — skipping")
    except Exception as e:
        print(f"❌ Error in {file}: {e}")

print("📊 Total files successfully loaded:", len(all_data))

if not all_data:
    print("❌ No data loaded. Exiting.")
    cursor.close()
    conn.close()
    exit(1)

# Combine all data
final_df = pd.concat(all_data, ignore_index=True)
print("🎯 Total combined rows:", len(final_df))
print(final_df.columns.tolist())

# Keep only required columns
final_df = final_df[[
    'MDDS STC', 'STATE NAME', 'MDDS DTC', 'DISTRICT NAME',
    'MDDS Sub_DT', 'SUB-DISTRICT NAME', 'MDDS PLCN', 'Area Name'
]]

# Rename to clean names
final_df = final_df.rename(columns={
    'MDDS STC': 'state_code',
    'STATE NAME': 'state',
    'MDDS DTC': 'district_code',
    'DISTRICT NAME': 'district',
    'MDDS Sub_DT': 'subdistrict_code',
    'SUB-DISTRICT NAME': 'subdistrict',
    'MDDS PLCN': 'village_code',
    'Area Name': 'village'
})

# Remove nulls
final_df = final_df.dropna()

# Convert codes to string and strip whitespace
for col in ['state_code', 'district_code', 'subdistrict_code', 'village_code']:
    final_df[col] = final_df[col].astype(str).str.strip()

for col in ['state', 'district', 'subdistrict', 'village']:
    final_df[col] = final_df[col].astype(str).str.strip()

# ── Insert Country (once) ──────────────────────────────────────────────────────
cursor.execute("""
    INSERT INTO "Country"(name, code)
    VALUES ('India', 'IN')
    ON CONFLICT (code) DO NOTHING
""")
conn.commit()

cursor.execute('SELECT id FROM "Country" WHERE code = %s', ('IN',))
country_id = cursor.fetchone()[0]

# ── 1. Insert States ───────────────────────────────────────────────────────────
states = final_df[['state', 'state_code']].drop_duplicates().dropna()
for _, row in states.iterrows():
    try:
        cursor.execute("""
            INSERT INTO "State" (name, code, "countryId")
            VALUES (%s, %s, %s)
            ON CONFLICT (code) DO NOTHING
        """, (row['state'], row['state_code'], country_id))
    except Exception as e:
        print(f"Error inserting state {row['state']}: {e}")
        conn.rollback()
        continue

conn.commit()
print("✅ States synced.")

# ── 2. Insert Districts ────────────────────────────────────────────────────────
# Build state code → id lookup once
cursor.execute('SELECT code, id FROM "State"')
state_lookup = {str(code): sid for code, sid in cursor.fetchall()}

districts = final_df[['district', 'district_code', 'state_code']].drop_duplicates().dropna()
for _, row in districts.iterrows():
    s_id = state_lookup.get(row['state_code'])
    if s_id:
        try:
            cursor.execute("""
            INSERT INTO "District"(name, code, "stateId")
            VALUES (%s, %s, %s)
            ON CONFLICT (code, "stateId") DO NOTHING
            """, (row['district'], row['district_code'], s_id))
        except Exception as e:
            print(f"Error inserting district {row['district']}: {e}")
            conn.rollback()

conn.commit()
print("✅ Districts synced.")

# ── 3. Insert SubDistricts ─────────────────────────────────────────────────────
cursor.execute('SELECT code, id FROM "District"')
district_lookup = {str(code): did for code, did in cursor.fetchall()}

subs = final_df[['subdistrict', 'subdistrict_code', 'district_code']].drop_duplicates().dropna()
for _, row in subs.iterrows():
    d_id = district_lookup.get(row['district_code'])
    if d_id:
        try:
            cursor.execute("""
            INSERT INTO "SubDistrict"(name, code, "districtId")
            VALUES (%s, %s, %s)
            ON CONFLICT (code, "districtId") DO NOTHING
            """, (row['subdistrict'], row['subdistrict_code'], d_id))
        except Exception as e:
            print(f"Error inserting subdistrict {row['subdistrict']}: {e}")
            conn.rollback()

conn.commit()
print("✅ SubDistricts synced.")

# ── 4. Insert Villages (batched) ───────────────────────────────────────────────
from psycopg2.extras import execute_values

cursor.execute('SELECT code, id FROM "SubDistrict"')
sub_district_lookup = {str(code): sid for code, sid in cursor.fetchall()}

villages = final_df[['village', 'village_code', 'subdistrict_code']].drop_duplicates()

batch_size = 5000
total = len(villages)

for i in range(0, total, batch_size):
    batch = villages.iloc[i:i + batch_size]
    values = []

    for _, row in batch.iterrows():
        s_id = sub_district_lookup.get(str(row['subdistrict_code']))
        if s_id:
            values.append((row['village'], str(row['village_code']), s_id))

    if values:
        try:
            execute_values(cursor, """
            INSERT INTO "Village" (name, code, "subDistrictId")
            VALUES %s ON CONFLICT (code, "subDistrictId") DO NOTHING
            """, values)
            conn.commit()
        except Exception as e:
            print(f"❌ Batch error at {i}: {e}")
            conn.rollback()

    print(f"📦 Processed: {min(i + batch_size, total)}/{total} villages")

print("🎉 All data imported successfully!")
cursor.close()
conn.close()