import { MotionRoot } from "@/components/motion/motion-root";

/** Remonté à chaque navigation : transition de page + animations au scroll */
export default function Template({ children }: { children: React.ReactNode }) {
  return <MotionRoot>{children}</MotionRoot>;
}
