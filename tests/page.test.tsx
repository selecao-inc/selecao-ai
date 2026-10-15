import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "@/app/page";

test("準備中ページに社名と準備中のメッセージが表示される", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "株式会社セレソン" })).toBeTruthy();
  expect(screen.getByText("ただいまサイトを準備中です。")).toBeTruthy();
});
