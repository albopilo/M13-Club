import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

const { data, error } = await supabase.rpc("get_payment_logs", {
  p_limit: 100000,
  p_offset: 0,
});

console.log("RPC DATA:");
console.log(JSON.stringify(data));
console.log("TYPE:", typeof data);
console.log("IS ARRAY:", Array.isArray(data));

  if (error) {
    return new Response(error.message, { status: 500 });
  }

const rows = Array.isArray(data)
  ? data
  : data
  ? [data]
  : [];

const worksheet = XLSX.utils.json_to_sheet(rows);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Payment Logs"
  );

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  const filename = `PaymentLogs_${Date.now()}.xlsx`;

  const { error: uploadError } = await supabase.storage
    .from("exports")
    .upload(filename, buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (uploadError) {
    return new Response(uploadError.message, { status: 500 });
  }

  const { data: url } = supabase.storage
    .from("exports")
    .getPublicUrl(filename);

  return Response.json({
    success: true,
    url: url.publicUrl,
  });
});