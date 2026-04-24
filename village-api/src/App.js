import React, { useState } from "react";
import axios from "axios";

function App() {
  const BASE_URL = "http://localhost:3000/v1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subDistricts, setSubDistricts] = useState([]);
  const [villages, setVillages] = useState([]);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);

  const [darkMode, setDarkMode] = useState(true);

  const headers = {
    "x-api-key": apiKey,
    "x-api-secret": apiSecret,
  };

  /* ================= AUTH ================= */
  const signup = async () => {
    await axios.post("http://localhost:3000/signup", { email, password });
    alert("Signup successful");
  };

  const login = async () => {
    const res = await axios.post("http://localhost:3000/login", {
      email,
      password,
    });
    setToken(res.data.token);
  };

  const generateKey = async () => {
    const res = await axios.post(
      "http://localhost:3000/generate-key",
      {},
      { headers: { Authorization: token } }
    );
    setApiKey(res.data.apiKey);
    setApiSecret(res.data.apiSecret);
  };

  /* ================= DATA ================= */
  const loadStates = async () => {
    const res = await axios.get(`${BASE_URL}/states`, { headers });
    setStates(res.data.data);
  };

  const loadDistricts = async (id) => {
    const res = await axios.get(`${BASE_URL}/districts/${id}`, { headers });
    setDistricts(res.data.data);
  };

  const loadSubDistricts = async (id) => {
    const res = await axios.get(`${BASE_URL}/subdistricts/${id}`, { headers });
    setSubDistricts(res.data.data);
  };

  const loadVillages = async (id) => {
    const res = await axios.get(`${BASE_URL}/villages/${id}`, { headers });
    setVillages(res.data.data);
  };

  /* ================= SEARCH ================= */
  const handleSearch = async (value) => {
    setSearch(value);
    if (value.length < 2) return setResults([]);

    const res = await axios.get(`${BASE_URL}/autocomplete?q=${value}`, {
      headers,
    });

    setResults(res.data.data);
  };

  /* ================= STYLES ================= */
  const glass = {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
  };

  const btn = {
    padding: "10px 15px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg,#6366f1,#3b82f6)",
    color: "white",
    cursor: "pointer",
    margin: "5px",
  };

  const input = {
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #444",
    width: "100%",
    marginBottom: "10px",
    background: "#1e293b",
    color: "white",
  };

  const select = {
    ...input,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "20px",
        background: "linear-gradient(135deg,#0f172a,#1e293b)",
        color: "white",
      }}
    >
      <h1 style={{ textAlign: "center" }}>🚀 Village API Dashboard</h1>

      <button onClick={() => setDarkMode(!darkMode)} style={btn}>
        Toggle Mode
      </button>

      <div style={{ display: "flex", gap: "20px" }}>
        {/* LEFT PANEL */}
        <div style={{ flex: 1, ...glass }}>
          <h3>🔐 Auth</h3>

          <input
            placeholder="Email"
            style={input}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            style={input}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button style={btn} onClick={signup}>Signup</button>
          <button style={btn} onClick={login}>Login</button>

          <p>Token: {token?.slice(0, 20)}</p>

          <hr />

          <h3>🔑 API</h3>
          <button style={btn} onClick={generateKey}>Generate Key</button>

          <p>{apiKey}</p>
          <p>{apiSecret}</p>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 2, ...glass }}>
          {/* SEARCH */}
          <h3>🔍 Search</h3>
          <input
            placeholder="Search villages..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            style={input}
          />

          <ul style={{ maxHeight: "150px", overflowY: "auto" }}>
            {results.map((r, i) => (
              <li
                key={i}
                style={{
                  padding: "8px",
                  borderBottom: "1px solid #444",
                  cursor: "pointer",
                }}
              >
                {r.fullAddress}
              </li>
            ))}
          </ul>

          <hr />

          {/* DROPDOWN */}
          <h3>🌍 Location</h3>
          <button style={btn} onClick={loadStates}>Load States</button>

          <select style={select} onChange={(e) => loadDistricts(e.target.value)}>
            <option>Select State</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select style={select} onChange={(e) => loadSubDistricts(e.target.value)}>
            <option>Select District</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select style={select} onChange={(e) => loadVillages(e.target.value)}>
            <option>Select SubDistrict</option>
            {subDistricts.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <hr />

          {/* 3D CARDS */}
          <h3>🏡 Villages</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
            {villages.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#1e293b",
                  transition: "0.3s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    "rotateX(10deg) rotateY(-10deg) scale(1.05)";
                  e.currentTarget.style.boxShadow =
                    "0 20px 40px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {v.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;