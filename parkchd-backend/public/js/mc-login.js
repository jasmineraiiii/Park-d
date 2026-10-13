import { loginPage } from "./common.js";
loginPage({ role: "mc", endpoint: "/auth/admin", next: "/mc/dashboard" });
