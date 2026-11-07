import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Trash2, FileSpreadsheet, X, Package, CheckCircle2, ArrowUpRight } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import Papa from "papaparse";
import { formatPrice } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Product {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  stock_status: string;
  description: string | null;
  image_url: string | null;
  promo: string | null;
}

const EXPECTED_COLS = ["name", "description", "price", "image_url", "category", "stock_status", "promo", "product_url"];

// "৳1,299", "Tk 1299.50" or 1299 -> 1299; anything unparseable -> null.
const parsePrice = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseUrl = (value: unknown): string | null => {
  const v = value ? String(value).trim() : "";
  return /^https?:\/\//i.test(v) ? v : null;
};

// The database only accepts "in_stock" / "out_of_stock"; spreadsheets use many spellings.
const normalizeStockStatus = (value: unknown): "in_stock" | "out_of_stock" => {
  if (value === null || value === undefined || String(value).trim() === "") return "in_stock";
  const v = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["out_of_stock", "out", "oos", "sold_out", "unavailable", "no", "false", "0"].includes(v)) {
    return "out_of_stock";
  }
  return "in_stock";
};

const getCategoryColor =(category: string | null) => {
  if (!category) return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  const lower = category.toLowerCase();
  if (lower.includes("footwear") || lower.includes("shoe") || lower.includes("boot") || lower.includes("sneaker")) {
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  }
  if (lower.includes("top") || lower.includes("shirt") || lower.includes("t-shirt") || lower.includes("blouse") || lower.includes("jacket")) {
    return "bg-purple-500/20 text-purple-400 border-purple-500/30";
  }
  if (lower.includes("bottom") || lower.includes("pant") || lower.includes("jean") || lower.includes("skirt") || lower.includes("short")) {
    return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  }
  if (lower.includes("outerwear") || lower.includes("coat") || lower.includes("parka") || lower.includes("windbreaker")) {
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  }
  if (lower.includes("accessor") || lower.includes("bag") || lower.includes("belt") || lower.includes("hat") || lower.includes("scarf")) {
    return "bg-green-500/20 text-green-400 border-green-500/30";
  }
  return "bg-gray-500/20 text-gray-400 border-gray-500/30";
};

const Products = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("BDT");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);

  const fetchProducts = useCallback(async (bizId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price, stock_status, description, image_url, promo")
      .eq("business_id", bizId)
      .order("created_at", { ascending: false });
    if (!error && data) setProducts(data);
  }, []);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, currency")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        setBusinessId(data.id);
        setCurrency(data.currency);
        await fetchProducts(data.id);
      }
      setLoading(false);
    };
    init();
  }, [user, fetchProducts]);

  const normalizeRows = (raw: Record<string, unknown>[]): Record<string, unknown>[] => {
    return raw.map((row) => {
      const normalized: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        const lower = key.trim().toLowerCase().replace(/\s+/g, "_");
        if (EXPECTED_COLS.includes(lower)) {
          normalized[lower] = row[key];
        }
      }
      return normalized;
    }).filter((r) => r.name && String(r.name).trim() !== "");
  };

  const triggerEmbedProducts = async (bizId: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase URL or anon key.");
    }

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("No session; sign in again to generate embeddings.");
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/embed-products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ business_id: bizId }),
    });

    let payload: { error?: string; embedded_count?: number } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON body */
    }

    if (!res.ok) {
      const msg =
        typeof payload.error === "string" && payload.error
          ? payload.error
          : `Embedding request failed (${res.status}). Products were saved.`;
      throw new Error(msg);
    }
  };

  const insertProducts = async (rows: Record<string, unknown>[]) => {
    if (!businessId) return;
    setUploading(true);
    const toInsert = rows.map((r) => ({
      business_id: businessId,
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      price: parsePrice(r.price),
      image_url: parseUrl(r.image_url),
      category: r.category ? String(r.category) : null,
      stock_status: normalizeStockStatus(r.stock_status),
      promo: r.promo ? String(r.promo) : null,
      product_url: parseUrl(r.product_url),
    }));

    const { error } = await supabase.from("products").insert(toInsert);
    if (error) {
      toast.error("Failed to upload products: " + error.message);
      setUploading(false);
      return;
    }

    await fetchProducts(businessId);

    const embedToastId = toast.loading("Generating AI embeddings...");
    try {
      await triggerEmbedProducts(businessId);
      toast.success("Products uploaded and AI ready!", { id: embedToastId });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Embedding generation failed. Products were saved.";
      toast.error(message, { id: embedToastId });
    }

    setUploading(false);
  };

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const sizeKB = (file.size / 1024).toFixed(2);
    setSelectedFile({ name: file.name, size: `${sizeKB} KB` });

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = normalizeRows(results.data as Record<string, unknown>[]);
          if (rows.length === 0) {
            toast.error("No valid product rows found in CSV.");
            return;
          }
          insertProducts(rows);
        },
        error: () => toast.error("Failed to parse CSV file."),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
        const rows = normalizeRows(raw);
        if (rows.length === 0) {
          toast.error("No valid product rows found in spreadsheet.");
          return;
        }
        insertProducts(rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Unsupported file format. Please upload a CSV or XLSX file.");
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete product.");
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Product deleted.");
    }
  };

  const clearAll = async () => {
    if (!businessId) return;
    const { error } = await supabase.from("products").delete().eq("business_id", businessId);
    if (error) {
      toast.error("Failed to clear products.");
    } else {
      setProducts([]);
      toast.success("All products cleared.");
    }
  };

  if (loading) return <LoadingSpinner message="Loading products..." />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-muted-foreground mt-1">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          {products.length > 0 && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {products.length} products
            </Badge>
          )}
          {products.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300">
              <X className="mr-2 h-4 w-4" />
              Clear All Products
            </Button>
          )}
        </div>
      </div>

      {/* Upload zone */}
      {!selectedFile ? (
        <div
          className={`products-upload-zone flex items-center justify-center gap-4 px-4 py-4 cursor-pointer rounded-xl ${
            dragOver ? "drag-over" : ""
          }`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
          onDrop={onDrop}
          onClick={() => document.getElementById("product-file-input")?.click()}
        >
          <div className={`h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 ${dragOver ? "products-upload-icon" : ""}`}>
            <Upload className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-white">
            {uploading ? "Uploading..." : "Drop CSV or XLSX here or click to browse"}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-400 text-xs px-2 py-0.5">CSV</Badge>
            <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400 text-xs px-2 py-0.5">XLSX</Badge>
          </div>
          <input
            id="product-file-input"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onFileSelect}
            disabled={uploading}
          />
        </div>
      ) : null}
      {!selectedFile && (
        <p className="text-xs text-muted-foreground -mt-2">
          Columns: <code>name</code> (required), <code>description</code>, <code>price</code>, <code>category</code>,{" "}
          <code>stock_status</code>, <code>promo</code>, <code>image_url</code>, <code>product_url</code>
        </p>
      )}
      {!selectedFile ? null : (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">{selectedFile.size}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-red-400 shrink-0"
            onClick={() => setSelectedFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Products table */}
      {products.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="products-table-header">
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground font-semibold">Name</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground font-semibold">Price</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground font-semibold">Stock Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id} className="products-table-row border-border/50">
                      <TableCell className="products-name whitespace-nowrap">{p.name}</TableCell>
                      <TableCell>
                        {p.category && (
                          <Badge 
                            variant="outline" 
                            className={getCategoryColor(p.category)}
                          >
                            {p.category}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="products-price whitespace-nowrap">
                        {p.price != null ? formatPrice(p.price, currency) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={p.stock_status === "in_stock" ? "products-stock-in" : "products-stock-out"}
                        >
                          <span className={`h-2 w-2 rounded-full mr-2 ${p.stock_status === "in_stock" ? "bg-green-400" : "bg-red-400"}`} />
                          {p.stock_status === "in_stock" ? "In Stock" : "Out of Stock"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="products-delete-btn h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => deleteProduct(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 relative">
            <Package className="h-12 w-12 text-blue-400" />
            <div className="absolute -top-2 -right-2">
              <ArrowUpRight className="h-6 w-6 text-purple-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No products yet</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Upload a CSV or XLSX file to get started
          </p>
          <div className="mt-6 text-muted-foreground text-sm">
            <span className="text-blue-400">↑</span> Use the upload zone above
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
