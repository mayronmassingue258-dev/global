import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { ApplicationsProvider, useApplications } from "@/features/applications/ApplicationsProvider";
import { fakeApplicationService, makeScholarship } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import { SaveButton } from "./SaveButton";

function Status() {
  return <p data-testid="status">{useApplications().status}</p>;
}

describe("visitante sem login", () => {
  it("não busca candidaturas e 'Salvar' leva ao login, voltando à página", async () => {
    const nav = setupTestRouter("/scholarships/s-1");
    const service = fakeApplicationService();
    render(
      <SessionProvider user={null}>
        <ApplicationsProvider service={service}>
          <Status />
          <SaveButton scholarship={makeScholarship()} />
        </ApplicationsProvider>
      </SessionProvider>
    );
    expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    await userEvent.click(screen.getByRole("button", { name: /^Salvar:/ }));
    expect(nav.current()).toBe("/login?next=%2Fscholarships%2Fs-1");
    expect(service.items()).toEqual([]);
  });
});
