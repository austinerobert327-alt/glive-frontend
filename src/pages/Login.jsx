import { useState } from "react";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

function Login() {

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const navigate = useNavigate();
    const auth = getAuth();

    /* 🔥 EMAIL LOGIN (SMART: login OR register) */
    const handleLogin = async () => {

        setErrorMsg("");

        try {

            // try login
            const res = await signInWithEmailAndPassword(auth, email, password);

            await ensureUserWallet(res.user);

            navigate("/");

        } catch (err) {

            // if user not found → create account automatically
            if (err.code === "auth/user-not-found") {

                try {
                    const res = await createUserWithEmailAndPassword(auth, email, password);

                    await ensureUserWallet(res.user);

                    navigate("/");

                } catch (e) {
                    setErrorMsg("Login failed. Check your details");
                }

            } else if (err.code === "auth/wrong-password") {
                setErrorMsg("Incorrect password");
            } else if (err.code === "auth/invalid-email") {
                setErrorMsg("Invalid email");
            } else {
                setErrorMsg("Login failed. Try again");
            }

        }

    };

    /* 🔥 GOOGLE LOGIN */
    const handleGoogleLogin = async () => {

        setErrorMsg("");

        try {

            const provider = new GoogleAuthProvider();

            const result = await signInWithPopup(auth, provider);

            await ensureUserWallet(result.user);

            navigate("/");

        } catch (err) {
            console.log(err);
            setErrorMsg("Google login failed");
        }

    };

    /* 🔥 ENSURE WALLET EXISTS */
    const ensureUserWallet = async (user) => {
        const ref = doc(db, "users", user.uid);

        await setDoc(ref, {
            email: user.email,
            coins: 0
        }, { merge: true });
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

                <h2 style={{ textAlign: "center" }}>Login</h2>

                {/* 🔴 ERROR MESSAGE */}
                {errorMsg && (
                    <p style={{ color: "red", fontSize: "13px", textAlign: "center" }}>
                        {errorMsg}
                    </p>
                )}

                <input
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
                    onClick={handleLogin}
                    style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ff0050",
                        color: "white",
                        fontWeight: "bold"
                    }}
                >
                    Continue with Email
                </button>

                {/* 🔥 GOOGLE BUTTON */}
                <button
                    onClick={handleGoogleLogin}
                    style={{
                        padding: "12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#fff",
                        color: "#000",
                        fontWeight: "bold"
                    }}
                >
                    Continue with Google
                </button>

                <p style={{ textAlign: "center", fontSize: "13px" }}>
                    No account? <Link to="/register">Register</Link>
                </p>

            </div>

        </div>

    )

}

export default Login;