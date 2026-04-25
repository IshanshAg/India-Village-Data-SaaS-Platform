import React, { useState } from "react";
import axios from "axios";
import "./App.css";

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

  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    const res = await axios.get(`${BASE_URL}/states`, { headers });
    setStates(res.data.data);
    setLoading(false);
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
    if (value.length < 2) {
      setResults([]);
      return;
    }

    const res = await axios.get(`${BASE_URL}/autocomplete?q=${value}`, {
      headers,
    });

    setResults(res.data.data);
  };

  return (
    <div className="app">
      <div className="container">

        <h1>🚀 GeoNest Dashboard</h1>

        {/* STATS */}
        <div className="stats">
          <div className="stat">
            <h3>{states.length}</h3>
            <p>States</p>
          </div>
          <div className="stat">
            <h3>{districts.length}</h3>
            <p>Districts</p>
          </div>
          <div className="stat">
            <h3>{villages.length}</h3>
            <p>Villages</p>
          </div>
        </div>

        {/* AUTH */}
        <div className="card">
          <h3>🔐 Authentication</h3>

          <div className="row">
            <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="row">
            <button onClick={signup}>Signup</button>
            <button onClick={login}>Login</button>
            <button onClick={generateKey}>Generate Key</button>
          </div>

          {apiKey && (
            <div className="key-box">
              <p>🔑 {apiKey}</p>
              <p>🔒 {apiSecret}</p>
            </div>
          )}
        </div>

        {/* DATA */}
        <div className="card">
          <h3>🌍 Location Explorer</h3>

          <button className="primary" onClick={loadStates}>
            {loading ? "Loading..." : "Load States"}
          </button>

          <div className="row">
            <select onChange={(e) => loadDistricts(e.target.value)}>
              <option>Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select onChange={(e) => loadSubDistricts(e.target.value)}>
              <option>Select District</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <select onChange={(e) => loadVillages(e.target.value)}>
              <option>Select Subdistrict</option>
              {subDistricts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="results">
            {villages.map(v => (
              <div key={v.id} className="item">{v.name}</div>
            ))}
          </div>
        </div>

        {/* SEARCH */}
        <div className="card">
          <h3>🔍 Smart Search</h3>

          <input
            placeholder="Type village name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />

          <div className="dropdown">
            {results.map((r, i) => (
              <div key={i} className="dropdown-item">
                {r.name}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
