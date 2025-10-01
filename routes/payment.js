import express from "express";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const router = express.Router();

const supabase = createClient(
  "https://mtnoglhkltnmxmtzfdyt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bm9nbGhrbHRubXhtdHpmZHl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODY0OTMwNiwiZXhwIjoyMDc0MjI1MzA2fQ.PQtEH-FSsbst0u1RGfe_yL4DA9yZbjYyrA3MTwkjzXY"
);

router.post("/checkout", async (req, res) => {
  const { reservation_id, amount, email, first_name, last_name } = req.body;
  if (!reservation_id || !amount || !email)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const tx_ref = `res-${reservation_id.slice(0, 10)}-${Date.now() % 100000}`;
    const response = await axios.post(
      "https://api.chapa.co/v1/transaction/initialize",
      {
        amount,
        currency: "ETB",
        email,
        first_name,
        last_name,
        tx_ref,
        callback_url: `http://localhost:5000/api/payment/callback?reservation_id=${reservation_id}`,
        return_url: `http://localhost:5173/success`,
        customization: {
          title: "Semayawi Hotel",
          description: "Room Reservation Payment",
        },
      },
      {
        headers: {
          Authorization: `Bearer CHASECK_TEST-gYrQpcGVBLbYDMGIrGTsyiCqqyTPFO1o`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
router.get("/callback", async (req, res) => {
  const { reservation_id, status } = req.query;

  if (!reservation_id) {
    return res.status(400).send("Missing reservation_id");
  }

  if (status === "success") {
    // Update reservation
    const { data: reservation, error: updateError } = await supabase
      .from("reservations")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", reservation_id)
      .select()
      .single(); // expect one record

    if (updateError || !reservation) {
      console.error("Error updating reservation:", updateError);
      return res.status(500).send("Failed to update reservation");
    }

    // Insert payment record
    const { error: insertError } = await supabase.from("payments").insert([
      {
        reservation_id,
        amount: reservation.total_price,
        method: "mobilebank",
        status: "paid", // set payment status here
      },
    ]);

    if (insertError) {
      console.error("Error inserting payment:", insertError);
      return res.status(500).send("Failed to insert payment");
    }

    return res.redirect(`http://localhost:5173/success`);
  }

  return res.redirect(`http://localhost:5173/failure`);
});

export default router;
