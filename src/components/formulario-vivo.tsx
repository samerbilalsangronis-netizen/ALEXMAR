"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
/** GET filters, including inputs associated through form=id. Never use on write forms. */
export function FormularioVivo({
  children,
  ...props
}: React.ComponentProps<"form">) {
  const ref = useRef<HTMLFormElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter(),
    path = usePathname(),
    search = useSearchParams();
  const [pending, transition] = useTransition(),
    [typing, setTyping] = useState(false);
  const latest = useRef(search.toString());
  latest.current = search.toString();
  useEffect(() => {
    function update(e: Event) {
      const target = e.target as HTMLInputElement;
      if (target.form !== ref.current || target.type === "hidden") return;
      clearTimeout(timer.current);
      setTyping(true);
      timer.current = setTimeout(
        () => {
          const params = new URLSearchParams();
          new FormData(ref.current!).forEach((value, key) => {
            if (
              typeof value === "string" &&
              value &&
              key !== "pagina" &&
              key !== "productos_pagina"
            )
              params.append(key, value);
          });
          setTyping(false);
          if (params.toString() !== latest.current)
            transition(() =>
              router.replace(path + "?" + params, { scroll: false }),
            );
        },
        target.tagName === "SELECT" || target.type === "date" ? 0 : 220,
      );
    }
    document.addEventListener("input", update);
    document.addEventListener("change", update);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("input", update);
      document.removeEventListener("change", update);
    };
  }, [path, router]);
  useEffect(() => {
    if (pending || typing || !ref.current) return;
    for (const control of Array.from(ref.current.elements)) {
      if (
        !(
          control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement
        )
      )
        continue;
      if (
        control === document.activeElement ||
        !control.name ||
        ["hidden", "checkbox", "radio"].includes(control.type)
      )
        continue;
      if (search.has(control.name)) control.value = search.get(control.name)!;
      else if (control instanceof HTMLSelectElement)
        control.value =
          Array.from(control.options).find((o) => o.defaultSelected)?.value ||
          control.options[0]?.value ||
          "";
      else control.value = "";
    }
  }, [search, pending, typing]);
  return (
    <form
      {...props}
      ref={ref}
      onSubmit={(e) => e.preventDefault()}
      aria-busy={pending || typing}
    >
      {children}
      <small className="estado-busqueda" role="status">
        {pending || typing ? "Buscando…" : "Resultados actualizados"}
      </small>
    </form>
  );
}
