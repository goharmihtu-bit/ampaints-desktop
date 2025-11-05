import type { SaleWithItems } from "@shared/schema";

interface ThermalReceiptProps {
  sale: SaleWithItems;
  receiptSettings: {
    businessName: string;
    address: string;
    dealerText: string;
    dealerBrands: string;
    thankYou: string;
    fontSize?: string;
    itemFontSize?: string;
    padding?: string;
  };
}

function formatDate(dateStr: string | Date) {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString("en-GB");
}

export default function ThermalReceipt({ sale, receiptSettings }: ThermalReceiptProps) {
  const outstanding = Math.round(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid));
  
  // Default values
  const fontSize = receiptSettings.fontSize || '11px';
  const itemFontSize = receiptSettings.itemFontSize || '12px';
  const padding = receiptSettings.padding || '0 12px 12px 12px';

  return (
    <div className="hidden print:block font-mono leading-tight" style={{fontSize}}>
      <div className="w-[80mm] mx-auto bg-white" style={{padding}}>
        <div className="text-center">
          <h1 className="font-bold text-lg" style={{fontSize: '18px', fontWeight: 'bold', color: 'black', marginTop: '0', paddingTop: '0'}}>
            {receiptSettings.businessName}
          </h1>
          <p style={{color: 'black', fontWeight: 'bold', marginTop: '2px'}}>{receiptSettings.address}</p>
        </div>

        <div className="my-3 border-t border-dotted border-black pt-2" style={{color: 'black'}}>
          <p className="mt-2" style={{fontWeight: 'bold'}}>Invoice: {sale.id.slice(0, 8).toUpperCase()}</p>
          <p style={{fontWeight: 'bold'}}>{formatDate(sale.createdAt)} {new Date(sale.createdAt).toLocaleTimeString()}</p>
          <p style={{fontWeight: 'bold'}}>Customer: {sale.customerName}</p>
          <p style={{fontWeight: 'bold'}}>Phone: {sale.customerPhone}</p>
        </div>

        <table className="w-full border-collapse" style={{color: 'black', fontWeight: 'bold', fontSize: itemFontSize}}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1 pr-1">Item</th>
              <th className="text-right py-1 px-2" style={{minWidth: '32px'}}>Qty</th>
              <th className="text-right py-1 px-2" style={{minWidth: '45px'}}>Price</th>
              <th className="text-right py-1 pl-2" style={{minWidth: '50px'}}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.saleItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-200 last:border-none">
                <td className="py-1 pr-1 align-top">
                  <div className="font-medium" style={{color: 'black', fontWeight: 'bold', fontSize: itemFontSize}}>
                    {item.color.variant.product.productName} - {item.color.colorName}
                  </div>
                  <div style={{color: 'black', fontWeight: 'bold', fontSize: `calc(${itemFontSize} - 1px)`}}>
                    {item.color.colorCode} • {item.color.variant.packingSize}
                  </div>
                </td>
                <td className="text-right py-1 px-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '32px'}}>
                  {item.quantity}
                </td>
                <td className="text-right py-1 px-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '45px'}}>
                  {Math.round(parseFloat(item.rate))}
                </td>
                <td className="text-right font-semibold py-1 pl-2 align-top" style={{color: 'black', fontWeight: 'bold', minWidth: '50px'}}>
                  {Math.round(parseFloat(item.subtotal))}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t border-black font-semibold">
              <td className="py-2 text-left" style={{color: 'black', fontWeight: 'bold'}}>
                {sale.saleItems.length} Item{sale.saleItems.length > 1 ? "s" : ""}
              </td>
              <td className="text-right py-2" style={{color: 'black', fontWeight: 'bold'}}>
                {sale.saleItems.reduce((sum, i) => sum + i.quantity, 0)}
              </td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div style={{color: 'black', fontWeight: 'bold'}}>
          <div className="flex flex-col items-end text-right space-y-2 mt-3">
            <div className="flex justify-between w-48" style={{fontSize: '13px', fontWeight: 'bold'}}>
              <span className="font-bold w-24 text-right">Total:</span>
              <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>
                {Math.round(parseFloat(sale.totalAmount))}
              </span>
            </div>
            <div className="flex justify-between w-48" style={{fontSize: '13px', fontWeight: 'bold'}}>
              <span className="w-24 text-right">Paid:</span>
              <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>
                {Math.round(parseFloat(sale.amountPaid))}
              </span>
            </div>
            {outstanding > 0 && (
              <div className="flex justify-between w-48 font-bold" style={{fontSize: '13px', fontWeight: 'bold'}}>
                <span className="w-24 text-right">Balance:</span>
                <span className="w-24 text-right" style={{fontSize: '13px', fontWeight: 'bold'}}>
                  {Math.round(outstanding)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-4 border-t border-black pt-2" style={{color: 'black'}}>
          <p className="text-[11px] mt-1 font-bold uppercase" style={{fontSize: '11px', fontWeight: 'bold'}}>
            {receiptSettings.dealerText}
          </p>
          <p className="text-[12px] font-bold" style={{fontSize: '12px', fontWeight: 'bold'}}>
            {receiptSettings.dealerBrands}
          </p>
          <p className="text-[12px] mt-3 font-bold" style={{fontSize: '12px', fontWeight: 'bold', marginTop: '8px'}}>
            {receiptSettings.thankYou}
          </p>
        </div>
      </div>
    </div>
  );
}
