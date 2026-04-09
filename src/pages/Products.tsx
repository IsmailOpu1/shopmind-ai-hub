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
import { Upload, Trash2, FileSpreadsheet, X } from "lucide-react";
import Papa from "papaparse";
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

const EXPECTED_COLS = ["name", "description", "price", "image_url", "category", "stock_status", "promo"];

const Products = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
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
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        setBusinessId(data.id);
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

  const insertProducts = async (rows: Record<string, unknown>[]) => {
    if (!businessId) return;
    setUploading(true);
    const toInsert = rows.map((r) => ({
      business_id: businessId,
      name: String(r.name),
      description: r.description ? String(r.description) : null,
      price: r.price ? Number(r.price) : null,
      image_url: r.image_url ? String(r.image_url) : null,
      category: r.category ? String(r.category) : null,
      stock_status: r.stock_status ? String(r.stock_status) : "in_stock",
      promo: r.promo ? String(r.promo) : null,
    }));

    const { error } = await supabase.from("products").insert(toInsert);
    if (error) {
      toast.error("Failed to upload products: " + error.message);
    } else {
      toast.success(`${toInsert.length} product(s) uploaded successfully!`);
      await fetchProducts(businessId);
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
          console.log("Parsed CSV data:", results.data);
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
        console.log("Parsed XLSX data:", raw);
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

  if (loading) return <div className="text-muted-foreground">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        {products.length > 0 && (
          <Button variant="destructive" size="sm" onClick={clearAll}>
            <X className="mr-2 h-4 w-4" />
            Clear All Products
          </Button>
        )}
      </div>

      {/* Upload zone */}
      <Card>
        <CardContent className="p-0">
          <div
            className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
            onDrop={onDrop}
            onClick={() => document.getElementById("product-file-input")?.click()}
          >
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">
                {uploading ? "Uploading..." : "Drag & drop your file here, or click to browse"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports CSV and XLSX files
              </p>
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <FileSpreadsheet className="h-4 w-4" />
                <span>{selectedFile.name} ({selectedFile.size})</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Columns: name, description, price, image_url, category, stock_status, promo</span>
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
        </CardContent>
      </Card>

      {/* Products table */}
      {products.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.category && (
                        <Badge variant="secondary">{p.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.price != null ? `$${Number(p.price).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.stock_status === "in_stock" ? "default" : "destructive"}
                      >
                        {p.stock_status === "in_stock" ? "In Stock" : "Out of Stock"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteProduct(p.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {products.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No products uploaded yet. Upload a CSV or XLSX file to get started.
        </p>
      )}
    </div>
  );
};

export default Products;
