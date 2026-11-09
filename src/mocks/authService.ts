import type { AuthService } from "@/lib/api/auth";

// DEMONSTRAÇÃO (npm run dev, sem servidor): sempre "logado" como um estudante fictício. Nada é verificado nem guardado.
const demoUser = { id: "demo", email: "estudante@exemplo.com", name: "Estudante" };

export const mockAuthService: AuthService = {
  async me() {
    return demoUser;
  },
  async register(input) {
    return { ...demoUser, name: input.name, email: input.email };
  },
  async login(email) {
    return { ...demoUser, email };
  },
  async logout() {},
  async forgotPassword() {},
  async resetPassword() {}
};
