"use client"

import { useState, useCallback } from "react"

export function useSearch() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setIsSearchOpen(value.trim().length >= 2)
  }, [])

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false)
    setSearchQuery("")
  }, [])

  return {
    searchQuery,
    isSearchOpen,
    handleSearchChange,
    closeSearch,
  }
}
