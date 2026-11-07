import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  name: string;
  category?: string | null;
  price?: number | null;
  description?: string | null;
  image_url?: string | null;
  stock_status?: string;
  promo?: string | null;
  product_url?: string | null;
  currency?: string;
}

const ProductCard = ({
  name,
  category,
  price,
  description,
  image_url,
  stock_status = "in_stock",
  promo,
  product_url,
  currency = "BDT",
}: ProductCardProps) => {
  const link = product_url && /^https?:\/\//i.test(product_url) ? product_url : null;
  return (
    <div className="max-w-[300px] w-full rounded-xl border border-border bg-card shadow-md overflow-hidden product-card-hover transition-all duration-300">
      {/* Image */}
      <div className="h-40 bg-secondary flex items-center justify-center overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`text-muted-foreground text-sm ${image_url ? "hidden" : ""}`}>
          No image
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Name + badges row */}
        <div className="space-y-1.5">
          <h4 className="font-bold text-sm leading-tight">{name}</h4>
          <div className="flex flex-wrap gap-1.5">
            {category && (
              <Badge variant="secondary" className="text-xs">{category}</Badge>
            )}
            <Badge
              variant={stock_status === "in_stock" ? "default" : "destructive"}
              className="text-xs"
            >
              {stock_status === "in_stock" ? "In Stock" : "Out of Stock"}
            </Badge>
            {promo && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                {promo}
              </Badge>
            )}
          </div>
        </div>

        {/* Price */}
        {price != null && (
          <p className="text-lg font-bold text-primary">
            {formatPrice(price, currency)}
          </p>
        )}

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Actions */}
        {link && (
          <div className="flex gap-2 pt-1">
            <Button asChild size="sm" variant="outline" className="flex-1 text-xs h-8">
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                View product
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
