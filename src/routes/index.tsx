import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Tableau de Bord SIG — Province de Figuig" },
      {
        name: "description",
        content:
          "Tableau de bord interactif SIG de la Province de Figuig — axe Santé : carte, indicateurs et établissements de santé.",
      },
    ],
  }),
});

function Index() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/app/index.html#sante");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#475569",
      }}
    >
      <p>Chargement du tableau de bord…</p>
    </div>
  );
}
