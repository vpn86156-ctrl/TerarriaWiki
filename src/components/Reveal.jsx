import React, { forwardRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "../state/useReducedMotion.js";
const elements = {
  article: motion.article,
  section: motion.section,
  div: motion.div,
  button: motion.button,
  a: motion.a,
};
/** One viewport entrance per mounted card. Keyboard focus and reduced motion reveal immediately. */
export const Reveal = forwardRef(function Reveal(
  { as = "div", order = 0, direction = "up", children, ...props },
  ref,
) {
  const reduced = useReducedMotion(),
    [seen, setSeen] = useState(reduced);
  useEffect(() => {
    if (reduced) setSeen(true);
  }, [reduced]);
  const Element = elements[as] || motion.div;
  const variants = {
    hidden: {
      opacity: 0,
      y: 28,
      x: direction === "left" ? -10 : direction === "right" ? 10 : 0,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        type: "tween",
        duration: reduced ? 0 : 0.55,
        delay: reduced ? 0 : (order % 4) * 0.045,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };
  return (
    <Element
      ref={ref}
      {...props}
      initial={reduced ? false : "hidden"}
      animate={seen || reduced ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.08, margin: "0px 0px -12px 0px" }}
      variants={variants}
      onViewportEnter={() => setSeen(true)}
      onFocusCapture={(e) => {
        setSeen(true);
        props.onFocusCapture?.(e);
      }}
      data-reveal={reduced ? "static" : seen ? "visible" : "pending"}
    >
      {children}
    </Element>
  );
});
