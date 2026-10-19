"use client";

import React from "react";
import { motion } from "motion/react";
import UnderlineToBackground from "@/components/fancy/text/underline-to-background";

export default function UnderlineToBackgroundDemo() {
  const fadeInVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.08 },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  const words = "RIDES MADE EASIER WITH".split(" ");

  return (
    <div className="w-full min-h-[300px] flex flex-col items-center justify-center bg-white border border-neutral-200 p-8">
      <motion.h2
        className="text-black text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex flex-wrap items-center justify-center gap-2"
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
      >
        {words.map((word, index) => (
          <motion.span
            key={index}
            variants={wordVariants}
            className="inline-block"
          >
            {word}
          </motion.span>
        ))}
        <motion.span variants={wordVariants} className="inline-block">
          <UnderlineToBackground
            targetTextColor="#FFFFFF"
            className="cursor-pointer text-black"
          >
            BASE
          </UnderlineToBackground>
        </motion.span>
      </motion.h2>
    </div>
  );
}
