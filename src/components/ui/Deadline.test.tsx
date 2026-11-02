import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeadlineBadge } from "./DeadlineBadge";
import { DeadlineCard } from "./DeadlineCard";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2027-01-01T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("DeadlineBadge", () => {
  it("mostra urgência em texto", () => {
    render(<DeadlineBadge deadline="2027-01-05" />);
    expect(screen.getByText("Faltam 4 dias")).toBeInTheDocument();
  });

  it("prazos distantes não ganham selo (exceto se pedido)", () => {
    const { container, rerender } = render(<DeadlineBadge deadline="2027-06-01" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DeadlineBadge deadline="2027-06-01" showNormal />);
    expect(screen.getByText("Faltam 151 dias")).toBeInTheDocument();
  });
});

describe("DeadlineCard", () => {
  it("mostra data, situação e fuso", () => {
    render(<DeadlineCard deadline="2026-12-20" timezone="" />);
    expect(screen.getByText(/20 de dez/)).toBeInTheDocument();
    expect(screen.getByText("Prazo encerrado · fuso não informado")).toBeInTheDocument();
  });
});
