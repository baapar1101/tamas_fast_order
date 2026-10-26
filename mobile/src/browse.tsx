import React, { createContext, useContext, useState } from "react";

function useBrowseState() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [sort, setSort] = useState("price_asc");
  const [inStock, setInStock] = useState(true);
  const [quick, setQuick] = useState(false);
  const [flag, setFlag] = useState("all");
  return {
    search,
    setSearch,
    category,
    setCategory,
    brands,
    setBrands,
    sort,
    setSort,
    inStock,
    setInStock,
    quick,
    setQuick,
    flag,
    setFlag,
  };
}
const Context = createContext<ReturnType<typeof useBrowseState> | null>(null);
export function BrowseProvider({ children }: { children: React.ReactNode }) {
  const value = useBrowseState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBrowse() {
  const value = useContext(Context);
  if (!value) throw new Error("BrowseProvider missing");
  return value;
}
