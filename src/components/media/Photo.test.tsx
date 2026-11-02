import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Photo } from "./Photo";

describe("Photo", () => {
  it("usa next/image quando o arquivo existe em public/images", () => {
    render(<Photo name="hero" alt="Estudante" sizes="100vw" />);
    const img = screen.getByRole("img", { name: "Estudante" });
    expect(img.getAttribute("src")).toContain("hero-student-skyline.jpg");
    expect(img).toHaveAttribute("sizes", "100vw");
  });

  it("mostra painel decorativo quando a foto ainda não foi adicionada", () => {
    const { container } = render(<Photo name="campus" sizes="100vw" fallback={<span>01</span>} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const panel = container.querySelector('[data-photo-fallback="campus"]');
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveTextContent("01");
  });
});
