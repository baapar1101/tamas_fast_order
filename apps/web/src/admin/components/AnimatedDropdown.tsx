import { useState, useRef, FC, ReactNode, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: any[]) { return twMerge(clsx(inputs)) }

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, handler])
}

const OnClickOutside: FC<{ children: ReactNode, onClickOutside: () => void, classes?: string }> = ({ children, onClickOutside, classes }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapperRef, onClickOutside)
  return <div ref={wrapperRef} className={cn(classes)}>{children}</div>
}

export interface DropdownOption {
  value: string;
  label: ReactNode;
}

export interface AnimatedDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  id?: string;
  prefix?: ReactNode;
}

export function AnimatedDropdown({
  options,
  value,
  onChange,
  className,
  buttonClassName,
  placeholder = 'انتخاب کنید',
  id,
  prefix
}: AnimatedDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find(o => o.value === value)

  return (
    <OnClickOutside onClickOutside={() => setIsOpen(false)} classes={cn('relative inline-block w-full', className)}>
      <button
        id={id}
        type="button"
        className={cn(
          "pp-btn pp-btn--secondary w-full justify-between",
          buttonClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2">
          {prefix && <span className="opacity-70 font-normal">{prefix}</span>}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-4 w-4 opacity-50" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
            className="absolute top-[calc(100%+0.3rem)] left-0 z-50 w-full min-w-[150px] overflow-hidden rounded-xl border border-[var(--pp-border)] bg-[var(--pp-bg-card)] shadow-xl"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.03,
                  },
                },
              }}
              className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5"
            >
              {options.map((item, index) => (
                <motion.button
                  key={item.value + index}
                  type="button"
                  onClick={() => {
                    onChange(item.value)
                    setIsOpen(false)
                  }}
                  variants={{
                    hidden: { opacity: 0, x: 20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  className={cn(
                    'block w-full text-right px-3 py-2 text-sm rounded-lg transition-colors duration-150',
                    value === item.value
                      ? 'bg-emerald-500/15 text-emerald-500 font-bold'
                      : 'text-[var(--a-t1)] hover:bg-[var(--a-hover)]'
                  )}
                >
                  {item.label}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OnClickOutside>
  )
}
