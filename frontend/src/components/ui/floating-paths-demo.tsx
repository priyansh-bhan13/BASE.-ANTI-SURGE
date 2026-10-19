import React from "react";
import { FloatingPathsBackground } from "@/components/ui/floating-paths";

export default function FloatingPathsBackgroundExample() {
  return (
    <FloatingPathsBackground
      className="aspect-16/9 flex items-center justify-center min-h-[400px]"
      position={-1}
    >
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold tracking-tight text-black">Base Floating Paths</h2>
        <p className="text-sm text-neutral-600 mt-2">Crisp black paths on pure white minimalist canvas</p>
      </div>
    </FloatingPathsBackground>
  );
}
