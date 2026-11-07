import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProductCard from "./ProductCard";

const base = { name: "Tortoise Sunglasses", price: 1499, currency: "BDT" };

describe("ProductCard", () => {
  it("shows price in the store currency and no buttons by default", () => {
    render(<ProductCard {...base} />);
    expect(screen.getByText("৳1,499")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view product/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
  });

  it("links to the product page and reports the click", () => {
    const onViewClick = vi.fn();
    render(<ProductCard {...base} product_url="https://shop.example.com/p/1" onViewClick={onViewClick} />);
    const link = screen.getByRole("link", { name: /view product/i });
    expect(link).toHaveAttribute("href", "https://shop.example.com/p/1");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(onViewClick).toHaveBeenCalledOnce();
  });

  it("never links to non-web URLs", () => {
    render(<ProductCard {...base} product_url="javascript:alert(1)" />);
    expect(screen.queryByRole("link", { name: /view product/i })).toBeNull();
  });

  it("offers Add to cart only for in-stock products", () => {
    const onAddToCart = vi.fn();
    const { rerender } = render(<ProductCard {...base} onAddToCart={onAddToCart} />);
    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(onAddToCart).toHaveBeenCalledOnce();

    rerender(<ProductCard {...base} stock_status="out_of_stock" onAddToCart={onAddToCart} />);
    expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });
});
