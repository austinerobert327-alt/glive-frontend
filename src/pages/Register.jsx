import { useState } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function Register() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();
  const auth = getAuth();

  const handleRegister = async () => {

    setErrorMsg("");

    if (!username || !email || !password) {
      setErrorMsg("Please fill all fields");
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

      if (err.code === "auth/email-already-in-use") {
        setErrorMsg("Email already in use");
      } else if (err.code === "auth/invalid-email") {
        setErrorMsg("Invalid email");
      } else if (err.code === "auth/weak-password") {
        setErrorMsg("Password should be at least 6 characters");
      } else {
        setErrorMsg("Registration failed. Try again");
      }

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

        {/* 🔴 ERROR MESSAGE */}
        {errorMsg && (
          <p style={{ color: "red", fontSize: "13px", textAlign: "center" }}>
            {errorMsg}
          </p>
        )}

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
          Continue
        </button>

        <p style={{ textAlign: "center", fontSize: "13px", color: "white" }}>
          Already have account? <Link to="/login">Login</Link>
        </p>

      </div>

    </div>

  );

}

export default Register;