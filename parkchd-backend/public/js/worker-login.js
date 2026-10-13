import { loginPage } from "./common.js";
loginPage({ role: "worker", endpoint: "/auth/attendant", next: "/worker/dashboard" });
