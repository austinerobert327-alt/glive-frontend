import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function Register() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const navigate = useNavigate();
  const auth = getAuth();

  const handleRegister = async () => {

    if (!username || !email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: username
      });

      /* CREATE WALLET */

      await setDoc(doc(db, "users", user.uid), {
        username: username,
        email: user.email,
        coins: 0,
        createdAt: serverTimestamp()
      });

      navigate("/");

    } catch (err) {

      alert(err.message);

    }

  };

  return (

    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#000"
    }}>

      <div style={{
        width: "90%",
        maxWidth: "350px",
        background: "#111",
        padding: "25px",
        borderRadius: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>

        <h2 style={{ textAlign: "center", color: "white" }}>Create Account</h2>

        <input
          value={username}
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: "#222",
            color: "white"
          }}
        />

        <input
          value={email}
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: "#222",
            color: "white"
          }}
        />

        <input
          value={password}
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: "#222",
            color: "white"
          }}
        />

        <button
          onClick={handleRegister}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            background: "#ff0050",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Register
        </button>

        <p style={{ textAlign: "center", fontSize: "13px", color: "white" }}>
          Already have account? <Link to="/login">Login</Link>
        </p>

      </div>

    </div>

  );

}

export default Register;