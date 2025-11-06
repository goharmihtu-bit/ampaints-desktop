import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
import type { ColorWithVariantAndProduct, Settings } from "@shared/schema";
import { getEffectiveRate } from "@shared/schema";

interface ProductCardProps {
  color: ColorWithVariantAndProduct;
  onAddToCart: (color: ColorWithVariantAndProduct) => void;
  onClick: (color: ColorWithVariantAndProduct) => void;
  settings?: Settings;
}

const StockQuantity = ({ stock, required = 0, showBorder = false }: { stock: number; required?: number; showBorder?: boolean }) => {
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 10;
  const hasInsufficientStock = required > stock;
  const borderClass = showBorder ? "" : "border-0";

  if (isOutOfStock) {
    return (
      <Badge variant="outline" className={`bg-red-50 text-red-700 text-xs px-2 py-1 ${borderClass}`}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Out of Stock
      </Badge>
    );
  } else if (hasInsufficientStock) {
    return (
      <Badge variant="outline" className={`bg-orange-50 text-orange-700 text-xs px-2 py-1 ${borderClass}`}>
        <AlertTriangle className="h-3 w-3 mr-1" />
        Low: {stock} (Need: {required})
      </Badge>
    );
  } else if (isLowStock) {
    return (
      <Badge variant="outline" className={`bg-orange-50 text-orange-700 text-xs px-2 py-1 ${borderClass}`}>
        Low: {stock}
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className={`bg-green-50 text-green-700 text-xs px-2 py-1 ${borderClass}`}>
        {stock}
      </Badge>
    );
  }
};

export function ProductCard({ color, onAddToCart, onClick, settings }: ProductCardProps) {
  const cardBorderStyle = settings?.cardBorderStyle ?? 'shadow';
  const cardShadowSize = settings?.cardShadowSize ?? 'sm';
  const cardButtonColor = settings?.cardButtonColor ?? 'gray-900';
  const cardPriceColor = settings?.cardPriceColor ?? 'blue-600';
  const showStockBadgeBorder = settings?.showStockBadgeBorder ?? false;

  const getCardClassName = () => {
    let baseClass = "bg-white transition-all cursor-pointer";
    
    if (cardBorderStyle === 'shadow') {
      const shadowSizes = {
        sm: 'shadow-sm hover:shadow-lg',
        md: 'shadow-md hover:shadow-xl',
        lg: 'shadow-lg hover:shadow-2xl',
      };
      return `${baseClass} ${shadowSizes[cardShadowSize]}`;
    } else if (cardBorderStyle === 'border') {
      return `${baseClass} border-2 hover:border-gray-400`;
    } else {
      return `${baseClass} hover:bg-gray-50`;
    }
  };

  const getButtonClassName = () => {
    const buttonColors: Record<string, string> = {
      'gray-900': 'bg-gray-900 hover:bg-gray-800',
      'blue-600': 'bg-blue-600 hover:bg-blue-700',
      'green-600': 'bg-green-600 hover:bg-green-700',
      'purple-600': 'bg-purple-600 hover:bg-purple-700',
      'red-600': 'bg-red-600 hover:bg-red-700',
    };
    return buttonColors[cardButtonColor] || 'bg-gray-900 hover:bg-gray-800';
  };

  const getPriceClassName = () => {
    const priceColors: Record<string, string> = {
      'blue-600': 'text-blue-600',
      'green-600': 'text-green-600',
      'purple-600': 'text-purple-600',
      'gray-900': 'text-gray-900',
      'orange-600': 'text-orange-600',
    };
    return priceColors[cardPriceColor] || 'text-blue-600';
  };

  return (
    <Card 
      className={getCardClassName()}
      onClick={() => onClick(color)}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Top: Company & Product */}
          <div>
            <div className="text-base font-semibold text-gray-900 truncate uppercase">
              {color.variant.product.company}
            </div>
            <div className="text-sm text-gray-600 truncate uppercase">
              {color.variant.product.productName}
            </div>
          </div>

          {/* One Line: Color Code Badge, Color Name, Packing Size - Left Aligned */}
          <div className="flex items-center gap-2 py-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-semibold px-3 py-1 text-sm uppercase">
              {color.colorCode}
            </Badge>
            <div className="text-sm font-semibold text-gray-900 uppercase">
              {color.colorName} - {color.variant.packingSize}
            </div>
          </div>

          {/* Stock (Left) & Price (Right) Row */}
          <div className="flex items-center justify-between pt-2">
            <StockQuantity stock={color.stockQuantity} showBorder={showStockBadgeBorder} />
            <div className={`text-xl font-bold ${getPriceClassName()}`}>
              Rs. {Math.round(parseFloat(getEffectiveRate(color)))}
              {color.rateOverride && <span className="text-xs text-orange-500 ml-1">*</span>}
            </div>
          </div>

          {/* Bottom: Add to Cart Button */}
          <Button
            className={`w-full h-9 ${getButtonClassName()} text-white text-sm font-medium uppercase shadow-md`}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(color);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
