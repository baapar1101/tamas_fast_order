const fs = require('fs');
const file = 'd:/tamas_fast_order/apps/web/src/storefront/StorefrontPage.tsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
  "  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');\r\n  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');",
  "  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');"
);
c = c.replace(
  "  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');\n  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');",
  "  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');"
);
fs.writeFileSync(file, c);
