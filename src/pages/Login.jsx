import { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";

function Login() {

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const navigate = useNavigate()
    const auth = getAuth()

    const handleLogin = async () => {

        try {

            await signInWithEmailAndPassword(auth, email, password)

            navigate("/")

        } catch (err) {

            alert(err.message)

        }

    }

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
                    Login
                </button>

                <p style={{ textAlign: "center", fontSize: "13px" }}>
                    No account? <Link to="/register">Register</Link>
                </p>

            </div>

        </div>

    )

}

export default Login