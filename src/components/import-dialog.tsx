"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { importItems } from "@/app/actions/studio";

type Field = {
  slug: string;
  name: string;
  field_type: string;
  is_required: boolean;
};

type ValidationError = {
  row: number;
  field: string;
  message: string;
};

type Step = "upload" | "mapping" | "errors" | "success";

interface ImportDialogProps {
  fields: Field[];
  collectionSlug: string;
}

export function ImportDialog({ fields, collectionSlug }: ImportDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setLoading(false);
    setFileName("");
    setCsvColumns([]);
    setParsedRows([]);
    setFieldMapping({});
    setValidationErrors([]);
    setImportResult(null);
  }, []);

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) reset();
  }

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === "csv") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          if (results.data.length === 0) {
            toast.error("File is empty or has no data rows");
            return;
          }
          const cols = results.meta.fields ?? Object.keys(results.data[0]);
          setCsvColumns(cols);
          setParsedRows(results.data);
          autoMap(cols);
          setStep("mapping");
        },
        error() {
          toast.error("Failed to parse CSV file");
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" });
          const sheetName = wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
          if (data.length === 0) {
            toast.error("Sheet is empty or has no data rows");
            return;
          }
          const cols = Object.keys(data[0]);
          setCsvColumns(cols);
          setParsedRows(data);
          autoMap(cols);
          setStep("mapping");
        } catch {
          toast.error("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Unsupported file type. Use CSV or Excel (.xlsx)");
    }
  }

  function autoMap(cols: string[]) {
    const mapping: Record<string, string> = {};
    for (const col of cols) {
      const lower = col.toLowerCase().trim();
      const match = fields.find(
        (f) =>
          f.slug === lower ||
          f.name.toLowerCase() === lower ||
          f.slug.replace(/-/g, " ") === lower ||
          f.name.toLowerCase().replace(/[^a-z0-9]/g, "") === lower.replace(/[^a-z0-9]/g, "")
      );
      if (match) mapping[col] = match.slug;
    }
    setFieldMapping(mapping);
  }

  async function handleImport() {
    setLoading(true);
    setValidationErrors([]);

    try {
      const result = await importItems(collectionSlug, parsedRows, fieldMapping);
      type ImportRes = {
        error?: string;
        data?: { imported: number; total: number };
        validationErrors?: Array<{ row: number; field: string; message: string }>;
        totalRows?: number;
        validCount?: number;
      };
      const res = result as ImportRes;

      if (res.validationErrors && res.validationErrors.length > 0) {
        setValidationErrors(res.validationErrors);
        setStep("errors");
        setLoading(false);
        return;
      }

      if (res.error) {
        toast.error(res.error);
        setLoading(false);
        return;
      }

      if (res.data) {
        setImportResult(res.data);
        setStep("success");
        router.refresh();
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  }

  // Count mapped fields
  const mappedCount = Object.values(fieldMapping).filter(Boolean).length;
  const requiredFields = fields.filter((f) => f.is_required);
  const unmappedRequired = requiredFields.filter(
    (f) => !Object.values(fieldMapping).includes(f.slug)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-zinc-700/50 text-zinc-400 hover:border-gray-300 hover:text-blue-600"
          />
        }
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </DialogTrigger>

      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle
            className="text-blue-600"
            style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
          >
            Import Items
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {step === "upload" && "Upload a CSV or Excel file to import records."}
            {step === "mapping" && "Map file columns to collection fields."}
            {step === "errors" && "Fix validation errors and try again."}
            {step === "success" && "Import completed successfully."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Upload */}
        {step === "upload" && (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center w-full py-12 rounded-lg border-2 border-dashed border-zinc-700/50 hover:border-gray-300 transition-colors cursor-pointer group"
            >
              <FileSpreadsheet className="h-10 w-10 text-zinc-600 group-hover:text-blue-600 transition-colors mb-3" />
              <p className="text-sm text-zinc-400 group-hover:text-blue-600 transition-colors">
                Click to upload CSV or Excel file
              </p>
              <p className="text-xs text-zinc-600 mt-1">.csv, .xlsx, .xls</p>
            </button>
          </div>
        )}

        {/* Step 2: Field Mapping */}
        {step === "mapping" && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                <FileSpreadsheet className="inline h-3.5 w-3.5 mr-1" />
                {fileName} — {parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-500">{mappedCount}/{csvColumns.length} mapped</span>
            </div>

            {unmappedRequired.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Required fields not mapped:{" "}
                  {unmappedRequired.map((f) => f.name).join(", ")}
                </span>
              </div>
            )}

            <div className="max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-zinc-400 w-[45%]">File Column</TableHead>
                    <TableHead className="text-zinc-400 w-[10%] text-center">&rarr;</TableHead>
                    <TableHead className="text-zinc-400 w-[45%]">Collection Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvColumns.map((col) => (
                    <TableRow key={col}>
                      <TableCell className="text-sm font-mono">{col}</TableCell>
                      <TableCell className="text-center text-zinc-600">&rarr;</TableCell>
                      <TableCell>
                        <Select
                          value={fieldMapping[col] ?? "__skip__"}
                          onValueChange={(val) =>
                            setFieldMapping((prev) => ({
                              ...prev,
                              [col]: val === "__skip__" ? "" : val ?? "",
                            } as Record<string, string>))
                          }
                        >
                          <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-gray-300 text-gray-900">
                            <SelectItem value="__skip__">
                              <span className="text-zinc-500">— Skip —</span>
                            </SelectItem>
                            {fields.map((f) => (
                              <SelectItem key={f.slug} value={f.slug}>
                                {f.name}
                                <span className="text-zinc-500 ml-1 text-xs">({f.field_type})</span>
                                {f.is_required && <span className="text-red-400 ml-1">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Preview first 3 rows */}
            {parsedRows.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-2">Preview (first 3 rows):</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvColumns.map((col) => (
                          <TableHead key={col} className="text-zinc-500 text-xs whitespace-nowrap">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {csvColumns.map((col) => (
                            <TableCell key={col} className="text-xs max-w-[120px] truncate">
                              {String(row[col] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Validation Errors */}
        {step === "errors" && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {validationErrors.length} validation error{validationErrors.length !== 1 ? "s" : ""} found. No rows were imported. Fix the issues and re-upload.
              </span>
            </div>

            <div className="max-h-[40vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-zinc-400 w-16">Row</TableHead>
                    <TableHead className="text-zinc-400">Field</TableHead>
                    <TableHead className="text-zinc-400">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationErrors.slice(0, 100).map((err, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-mono text-zinc-400">{err.row}</TableCell>
                      <TableCell className="text-sm">{err.field}</TableCell>
                      <TableCell className="text-sm text-red-400">{err.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validationErrors.length > 100 && (
                <p className="text-xs text-zinc-500 mt-2 text-center">
                  Showing first 100 of {validationErrors.length} errors
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && importResult && (
          <div className="mt-4 flex flex-col items-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-lime-400" />
            <p className="text-lg font-semibold text-lime-400">Import Complete</p>
            <p className="text-sm text-zinc-400">
              Successfully imported {importResult.imported} of {importResult.total} rows.
            </p>
          </div>
        )}

        <DialogFooter className="mt-6">
          {step === "upload" && (
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                />
              }
            >
              Cancel
            </DialogClose>
          )}

          {step === "mapping" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => { reset(); setStep("upload"); }}
                className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={loading || mappedCount === 0}
                className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
              >
                {loading ? "Importing..." : `Import ${parsedRows.length} Rows`}
              </Button>
            </>
          )}

          {step === "errors" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("mapping")}
                className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
              >
                Back to Mapping
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
              >
                Re-upload
              </Button>
            </>
          )}

          {step === "success" && (
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
