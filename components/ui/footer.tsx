"use client"

import { Facebook, Twitter, Instagram, Linkedin, Github } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {VELOCE_BLACK_LOG, VELOCE_WEBSITE } from "@/constants/constants";

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-slate-900 text-white border-t border-slate-800">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Company Logo Only */}
          <Link href={VELOCE_WEBSITE} target="_blank">
            <div>
              <img
                src={VELOCE_BLACK_LOG}
                alt="VELOCE Logo"
                className="h-8 w-32 object-contain brightness-0 invert"
              />
            </div>
          </Link>

          {/* Social Media Links */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white">
              <Facebook className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white">
              <Twitter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white">
              <Instagram className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white">
              <Linkedin className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-800 text-slate-400 hover:text-white">
              <Github className="h-4 w-4" />
            </Button>
          </div>

          {/* Copyright */}
          <div className="text-sm text-slate-400">
            <span>© {currentYear}
              <Link href={VELOCE_WEBSITE} target="_blank" className="font-bold"> VELOCE. </Link>
              All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
