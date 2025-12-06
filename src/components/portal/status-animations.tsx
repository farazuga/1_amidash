'use client';

import { motion } from 'framer-motion';

// Status color configurations
export const statusColors: Record<string, { bg: string; text: string; accent: string; glow: string }> = {
  'PO Received': { bg: 'bg-blue-50', text: 'text-blue-700', accent: '#3B82F6', glow: 'rgba(59, 130, 246, 0.3)' },
  'Engineering Review': { bg: 'bg-purple-50', text: 'text-purple-700', accent: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.3)' },
  'In Procurement': { bg: 'bg-orange-50', text: 'text-orange-700', accent: '#F97316', glow: 'rgba(249, 115, 22, 0.3)' },
  'Pending Scheduling': { bg: 'bg-teal-50', text: 'text-teal-700', accent: '#14B8A6', glow: 'rgba(20, 184, 166, 0.3)' },
  'Install Scheduled': { bg: 'bg-emerald-50', text: 'text-emerald-700', accent: '#10B981', glow: 'rgba(16, 185, 129, 0.3)' },
  'Install In Progress': { bg: 'bg-yellow-50', text: 'text-yellow-700', accent: '#EAB308', glow: 'rgba(234, 179, 8, 0.3)' },
  'Pending Shipping': { bg: 'bg-amber-50', text: 'text-amber-700', accent: '#F59E0B', glow: 'rgba(245, 158, 11, 0.3)' },
  'Shipped': { bg: 'bg-sky-50', text: 'text-sky-700', accent: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.3)' },
  'Invoiced': { bg: 'bg-green-50', text: 'text-green-700', accent: '#22C55E', glow: 'rgba(34, 197, 94, 0.3)' },
  'Hold': { bg: 'bg-orange-50', text: 'text-orange-700', accent: '#F97316', glow: 'rgba(249, 115, 22, 0.3)' },
};

// Friendly messages for each status
export const statusMessages: Record<string, string> = {
  'PO Received': "We've received your order and are getting started!",
  'Engineering Review': "Our engineers are designing the perfect solution for you.",
  'In Procurement': "We're sourcing the best components for your project.",
  'Pending Scheduling': "Getting ready to schedule your installation date.",
  'Install Scheduled': "Your installation date is confirmed!",
  'Install In Progress': "Our team is hard at work on your installation.",
  'Pending Shipping': "Your equipment is being carefully packed.",
  'Shipped': "Your order is on its way to you!",
  'Invoiced': "Project complete! Thank you for your business.",
  'Hold': "Your project is temporarily on hold. We'll be in touch soon.",
};

// PO Received - Document with checkmark stamp
export function POReceivedAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Document */}
      <motion.g
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <rect x="25" y="20" width="50" height="65" rx="3" fill="white" stroke="#3B82F6" strokeWidth="2" />
        {/* Lines on document */}
        <motion.line
          x1="32" y1="35" x2="68" y2="35"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        />
        <motion.line
          x1="32" y1="45" x2="60" y2="45"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        />
        <motion.line
          x1="32" y1="55" x2="55" y2="55"
          stroke="#CBD5E1"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        />
      </motion.g>

      {/* Checkmark stamp */}
      <motion.g
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 200, damping: 10 }}
      >
        <circle cx="75" cy="60" r="20" fill="#3B82F6" />
        <motion.path
          d="M65 60 L72 67 L85 54"
          fill="none"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.9, duration: 0.3 }}
        />
      </motion.g>

      {/* Sparkles */}
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={85 + i * 8}
          cy={40 - i * 5}
          r="2"
          fill="#3B82F6"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ delay: 1 + i * 0.1, duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
        />
      ))}
    </svg>
  );
}

// Engineering Review - Blueprints being drawn
export function EngineeringReviewAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Blueprint paper */}
      <rect x="15" y="25" width="70" height="55" rx="2" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="2" />

      {/* Grid lines */}
      {[35, 45, 55, 65].map((y, i) => (
        <motion.line
          key={`h-${i}`}
          x1="20" y1={y} x2="80" y2={y}
          stroke="#C4B5FD"
          strokeWidth="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
      {[30, 45, 60, 75].map((x, i) => (
        <motion.line
          key={`v-${i}`}
          x1={x} y1="30" x2={x} y2="75"
          stroke="#C4B5FD"
          strokeWidth="0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}

      {/* Drawing schematic */}
      <motion.rect
        x="30" y="40" width="25" height="20"
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
      />
      <motion.line
        x1="55" y1="50" x2="70" y2="50"
        stroke="#8B5CF6"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
      />
      <motion.circle
        cx="70" cy="50" r="8"
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 1, duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
      />

      {/* Pencil */}
      <motion.g
        animate={{ x: [0, 30, 30, 0], y: [0, 0, 20, 20] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <rect x="85" y="35" width="6" height="25" rx="1" fill="#F59E0B" />
        <polygon points="88,60 85,68 91,68" fill="#FCD34D" />
        <rect x="85" y="35" width="6" height="4" fill="#7C3AED" />
      </motion.g>
    </svg>
  );
}

// In Procurement - Cart filling with parts
export function InProcurementAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Shopping cart */}
      <motion.g
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <path
          d="M25 40 L35 40 L45 70 L75 70 L80 50 L40 50"
          fill="none"
          stroke="#F97316"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="80" r="5" fill="#F97316" />
        <circle cx="70" cy="80" r="5" fill="#F97316" />
      </motion.g>

      {/* Falling items */}
      {[0, 1, 2].map((i) => (
        <motion.g key={i}>
          <motion.rect
            x={45 + i * 12}
            y={20}
            width="8"
            height="8"
            rx="1"
            fill={['#3B82F6', '#10B981', '#8B5CF6'][i]}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: [20, 55], opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 0.8,
              delay: i * 0.4,
              repeat: Infinity,
              repeatDelay: 1.2,
            }}
          />
        </motion.g>
      ))}

      {/* Gear icon */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '95px 35px' }}
      >
        <circle cx="95" cy="35" r="12" fill="none" stroke="#F97316" strokeWidth="3" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="93"
            y="20"
            width="4"
            height="6"
            fill="#F97316"
            transform={`rotate(${angle} 95 35)`}
          />
        ))}
        <circle cx="95" cy="35" r="4" fill="#F97316" />
      </motion.g>
    </svg>
  );
}

// Pending Scheduling - Calendar with dates
export function PendingSchedulingAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Calendar */}
      <rect x="25" y="30" width="55" height="55" rx="4" fill="white" stroke="#14B8A6" strokeWidth="2" />
      <rect x="25" y="30" width="55" height="15" rx="4" fill="#14B8A6" />

      {/* Calendar hooks */}
      <rect x="35" y="25" width="4" height="12" rx="2" fill="#0D9488" />
      <rect x="66" y="25" width="4" height="12" rx="2" fill="#0D9488" />

      {/* Date grid */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <motion.rect
            key={`${row}-${col}`}
            x={32 + col * 12}
            y={52 + row * 10}
            width="8"
            height="6"
            rx="1"
            fill="#99F6E4"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (row * 4 + col) * 0.1, duration: 0.3 }}
          />
        ))
      )}

      {/* Highlighting a date */}
      <motion.rect
        x="44"
        y="62"
        width="8"
        height="6"
        rx="1"
        fill="#14B8A6"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />

      {/* Question marks floating */}
      <motion.text
        x="90"
        y="45"
        fontSize="16"
        fill="#14B8A6"
        animate={{ y: [45, 40, 45], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ?
      </motion.text>
    </svg>
  );
}

// Install Scheduled - Calendar with checkmark
export function InstallScheduledAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Calendar */}
      <rect x="25" y="30" width="55" height="55" rx="4" fill="white" stroke="#10B981" strokeWidth="2" />
      <rect x="25" y="30" width="55" height="15" rx="4" fill="#10B981" />

      {/* Calendar hooks */}
      <rect x="35" y="25" width="4" height="12" rx="2" fill="#059669" />
      <rect x="66" y="25" width="4" height="12" rx="2" fill="#059669" />

      {/* Big checkmark in calendar */}
      <motion.path
        d="M35 60 L48 73 L72 49"
        fill="none"
        stroke="#10B981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
      />

      {/* Celebration stars */}
      {[0, 1, 2].map((i) => (
        <motion.text
          key={i}
          x={85 + i * 5}
          y={35 + i * 10}
          fontSize="12"
          fill="#10B981"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ delay: 0.8 + i * 0.2, duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
        >
          ★
        </motion.text>
      ))}
    </svg>
  );
}

// Install In Progress - Tools working with sparks
export function InstallInProgressAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Wrench */}
      <motion.g
        animate={{ rotate: [-10, 10, -10] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        style={{ transformOrigin: '50px 60px' }}
      >
        <path
          d="M30 50 L50 60 L30 70 Z"
          fill="#EAB308"
        />
        <rect x="50" y="55" width="35" height="10" rx="2" fill="#EAB308" />
        <path
          d="M85 50 C95 50 95 70 85 70 L85 50"
          fill="#EAB308"
        />
        <rect x="87" y="57" width="5" height="6" fill="#FEF3C7" />
      </motion.g>

      {/* Sparks */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle
          key={i}
          cx={85}
          cy={60}
          r="2"
          fill="#EAB308"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: [0, (Math.random() - 0.5) * 40],
            y: [0, (Math.random() - 0.5) * 40],
            opacity: [1, 0],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.15,
            repeat: Infinity,
            repeatDelay: 0.3,
          }}
        />
      ))}

      {/* Progress indicator */}
      <rect x="25" y="85" width="70" height="8" rx="4" fill="#FEF3C7" />
      <motion.rect
        x="25"
        y="85"
        width="70"
        height="8"
        rx="4"
        fill="#EAB308"
        initial={{ width: 0 }}
        animate={{ width: [0, 70] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </svg>
  );
}

// Pending Shipping - Boxes being packed
export function PendingShippingAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Box */}
      <rect x="30" y="45" width="45" height="35" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
      <line x1="30" y1="55" x2="75" y2="55" stroke="#F59E0B" strokeWidth="2" />

      {/* Box flaps */}
      <motion.path
        d="M30 45 L52.5 30 L75 45"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2"
        initial={{ d: 'M30 45 L52.5 30 L75 45' }}
        animate={{ d: ['M30 45 L52.5 30 L75 45', 'M30 45 L52.5 45 L75 45', 'M30 45 L52.5 30 L75 45'] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Tape */}
      <motion.rect
        x="45"
        y="45"
        width="15"
        height="35"
        fill="#F59E0B"
        opacity="0.5"
        initial={{ height: 0 }}
        animate={{ height: 35 }}
        transition={{ delay: 1, duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
      />

      {/* Items going into box */}
      <motion.rect
        x="45"
        y="20"
        width="15"
        height="12"
        rx="2"
        fill="#3B82F6"
        animate={{ y: [0, 40], opacity: [1, 1, 0] }}
        transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
      />

      {/* Packing peanuts */}
      {[0, 1, 2].map((i) => (
        <motion.ellipse
          key={i}
          cx={40 + i * 12}
          cy={65}
          rx="4"
          ry="3"
          fill="#FDE68A"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.5, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </svg>
  );
}

// Shipped - Truck driving
export function ShippedAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Road */}
      <rect x="0" y="80" width="120" height="20" fill="#374151" />
      <motion.g
        animate={{ x: [0, -40] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        {[0, 40, 80, 120].map((x) => (
          <rect key={x} x={x} y="88" width="20" height="4" fill="#FCD34D" />
        ))}
      </motion.g>

      {/* Truck body */}
      <motion.g
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 0.3, repeat: Infinity }}
      >
        {/* Cargo */}
        <rect x="25" y="45" width="45" height="35" rx="2" fill="#0EA5E9" />
        <rect x="30" y="50" width="35" height="10" fill="#38BDF8" opacity="0.5" />

        {/* Cabin */}
        <rect x="70" y="55" width="25" height="25" rx="2" fill="#0EA5E9" />
        <rect x="75" y="60" width="15" height="10" rx="1" fill="#BAE6FD" />

        {/* Wheels */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '40px 80px' }}
        >
          <circle cx="40" cy="80" r="8" fill="#1F2937" />
          <circle cx="40" cy="80" r="3" fill="#6B7280" />
        </motion.g>
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '82px 80px' }}
        >
          <circle cx="82" cy="80" r="8" fill="#1F2937" />
          <circle cx="82" cy="80" r="3" fill="#6B7280" />
        </motion.g>
      </motion.g>

      {/* Speed lines */}
      {[0, 1, 2].map((i) => (
        <motion.line
          key={i}
          x1="5"
          y1={55 + i * 10}
          x2="20"
          y2={55 + i * 10}
          stroke="#0EA5E9"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: [0, 1, 0], x: [20, 0, -10] }}
          transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </svg>
  );
}

// Invoiced - Receipt with celebration
export function InvoicedAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Receipt */}
      <motion.g
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <path
          d="M35 25 L35 85 L40 80 L45 85 L50 80 L55 85 L60 80 L65 85 L70 80 L75 85 L75 25 Z"
          fill="white"
          stroke="#22C55E"
          strokeWidth="2"
        />

        {/* Receipt lines */}
        <line x1="42" y1="35" x2="68" y2="35" stroke="#86EFAC" strokeWidth="2" />
        <line x1="42" y1="45" x2="62" y2="45" stroke="#86EFAC" strokeWidth="2" />
        <line x1="42" y1="55" x2="58" y2="55" stroke="#86EFAC" strokeWidth="2" />

        {/* Total */}
        <line x1="42" y1="68" x2="68" y2="68" stroke="#22C55E" strokeWidth="2" />
        <motion.text
          x="55"
          y="78"
          fontSize="10"
          fill="#22C55E"
          textAnchor="middle"
          fontWeight="bold"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          PAID
        </motion.text>
      </motion.g>

      {/* Checkmark */}
      <motion.g
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
      >
        <circle cx="85" cy="45" r="15" fill="#22C55E" />
        <motion.path
          d="M77 45 L82 50 L93 39"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        />
      </motion.g>

      {/* Confetti */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.rect
          key={i}
          x={20 + i * 15}
          y={10}
          width="6"
          height="6"
          rx="1"
          fill={['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6'][i]}
          initial={{ y: -10, rotate: 0, opacity: 0 }}
          animate={{
            y: [10, 100],
            rotate: [0, 360],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 2,
            delay: i * 0.2,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      ))}
    </svg>
  );
}

// Hold - Pause/Hourglass
export function HoldAnimation() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Hourglass frame */}
      <rect x="35" y="25" width="50" height="8" rx="2" fill="#F97316" />
      <rect x="35" y="87" width="50" height="8" rx="2" fill="#F97316" />

      {/* Hourglass glass */}
      <path
        d="M40 33 L40 50 L60 65 L80 50 L80 33 Z"
        fill="#FED7AA"
        stroke="#F97316"
        strokeWidth="2"
      />
      <path
        d="M40 87 L40 70 L60 55 L80 70 L80 87 Z"
        fill="#FED7AA"
        stroke="#F97316"
        strokeWidth="2"
      />

      {/* Sand in top */}
      <motion.path
        d="M45 38 L45 48 L60 58 L75 48 L75 38 Z"
        fill="#F97316"
        animate={{ d: ['M45 38 L45 48 L60 58 L75 48 L75 38 Z', 'M55 50 L55 52 L60 58 L65 52 L65 50 Z'] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Sand in bottom */}
      <motion.path
        d="M60 75 L60 75 L60 75 Z"
        fill="#F97316"
        animate={{ d: ['M55 82 L60 75 L65 82 Z', 'M45 82 L60 68 L75 82 Z'] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Falling sand particles */}
      <motion.circle
        cx="60"
        cy="58"
        r="1.5"
        fill="#F97316"
        animate={{ y: [0, 15], opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* Pause icon overlay */}
      <motion.g
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <circle cx="95" cy="30" r="12" fill="#F97316" opacity="0.2" />
        <rect x="90" y="24" width="4" height="12" rx="1" fill="#F97316" />
        <rect x="96" y="24" width="4" height="12" rx="1" fill="#F97316" />
      </motion.g>
    </svg>
  );
}

// Main component that renders the right animation based on status
export function StatusAnimation({ statusName }: { statusName: string }) {
  const animations: Record<string, React.ReactNode> = {
    'PO Received': <POReceivedAnimation />,
    'Engineering Review': <EngineeringReviewAnimation />,
    'In Procurement': <InProcurementAnimation />,
    'Pending Scheduling': <PendingSchedulingAnimation />,
    'Install Scheduled': <InstallScheduledAnimation />,
    'Install In Progress': <InstallInProgressAnimation />,
    'Pending Shipping': <PendingShippingAnimation />,
    'Shipped': <ShippedAnimation />,
    'Invoiced': <InvoicedAnimation />,
    'Hold': <HoldAnimation />,
  };

  return (
    <div className="w-32 h-32 mx-auto">
      {animations[statusName] || <POReceivedAnimation />}
    </div>
  );
}
