import React, { useState } from "react";
import axios from "axios";

function App() {
  const API_BASE = "https://india-village-data-saas-platform-2.onrender.com";
  const BASE_URL = `${API_BASE}/v1`;

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

  const headers = {
    "x-api-key": apiKey,
    "x-api-secret": apiSecret,
  };

  /* AUTH */
  const signup = async () => {
    await axios.post(`${API_BASE}/signup`, { email, password });
    alert("Signup success");
  };

  const login = async () => {
    const res = await axios.post(`${API_BASE}/login`, { email, password });
    setToken(res.data.token);
  };

  const generateKey = async () => {
    const res = await axios.post(
      `${API_BASE}/generate-key`,
      {},
      { headers: { Authorization: token } }
    );
    setApiKey(res.data.apiKey);
    setApiSecret(res.data.apiSecret);
  };

  /* DATA */
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

  /* SEARCH */
  const handleSearch = async (value) => {
    setSearch(value);
    if (value.length < 2) return;

    const res = await axios.get(`${BASE_URL}/autocomplete?q=${value}`, {
      headers,
    });

    setResults(res.data.data);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Village API Dashboard</h2>

      <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" onChange={(e) => setPassword(e.target.value)} />

      <button onClick={signup}>Signup</button>
      <button onClick={login}>Login</button>

      <button onClick={generateKey}>Generate Key</button>

      <hr />

      <button onClick={loadStates}>Load States</button>

      <select onChange={(e) => loadDistricts(e.target.value)}>
        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select onChange={(e) => loadSubDistricts(e.target.value)}>
        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      <select onChange={(e) => loadVillages(e.target.value)}>
        {subDistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <input
        placeholder="Search..."
        onChange={(e) => handleSearch(e.target.value)}
      />

      {results.map((r, i) => (
        <div key={i}>{r.name}</div>
      ))}

      {villages.map((v) => (
        <div key={v.id}>{v.name}</div>
      ))}
    </div>
  );
}

export default App;
