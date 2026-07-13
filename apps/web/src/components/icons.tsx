/**
 * Restaurant Manager's own icon family.
 * Style: 1.7 stroke, rounded corners, 24×24, with hospitality touches.
 */

type IconProps = React.SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Home: little house with a shop awning. */
export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20" />
    </svg>
  );
}

/** Waiter view: order pad with a pencil. */
export function IconPos(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3.5h9a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8 3v2.5M10.5 3v2.5M13 3v2.5" />
      <path d="M8 10h5M8 13.5h3" />
      <path d="m19.5 8.5 1 1L15 15l-1.6.6.6-1.6 5.5-5.5Z" />
    </svg>
  );
}

/** Tables: round table seen from above with two chairs. */
export function IconTables(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M3.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M20.5 9.5a3.5 3.5 0 0 0 0 5" />
    </svg>
  );
}

/** Menus: an open restaurant menu with dishes. */
export function IconMenus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5.5C10 4 7 3.8 4.5 4.3V19c2.5-.5 5.5-.3 7.5 1.2 2-1.5 5-1.7 7.5-1.2V4.3C17 3.8 14 4 12 5.5Z" />
      <path d="M12 5.5v14.7" />
      <path d="M7 9h2.5M7 12.5h2.5M14.5 9H17M14.5 12.5H17" />
    </svg>
  );
}

/** Reservations: calendar with cutlery. */
export function IconReservations(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v3.5M16 3v3.5M3.5 9.5h17" />
      <path d="M9.5 12.5v5M9.5 12.5c-.8 0-1.3.7-1.3 1.5s.5 1.5 1.3 1.5" />
      <path d="M14.5 12.5v5M13.3 12.5v1.8a1.2 1.2 0 0 0 2.4 0v-1.8" />
    </svg>
  );
}

/** My page: storefront with an awning. */
export function IconStorefront(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9.5 5.2 4.8A1 1 0 0 1 6.2 4h11.6a1 1 0 0 1 1 .8L20 9.5" />
      <path d="M4 9.5c0 1.2.9 2.2 2.1 2.2s2.2-1 2.2-2.2c0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2c0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2c0 1.2.9 2.2 2.1 2.2" />
      <path d="M5.5 12v7.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V12" />
      <path d="M9.5 20v-4.5h5V20" />
    </svg>
  );
}

/** History: desk clock. */
export function IconHistory(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2" />
      <path d="M9 3.5h6" />
    </svg>
  );
}

/** Payments: card with contactless waves. */
export function IconPayments(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M6.5 15.5h4" />
      <path d="M15.5 14.2a2.6 2.6 0 0 1 2.6 2.5M15.5 16a1 1 0 0 1 .9.8" />
    </svg>
  );
}

/** Team: two people, one wearing a chef's hat. */
export function IconTeam(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="10" r="3" />
      <path d="M3.5 20c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5" />
      <path d="M7 7.3C6.8 5.5 7.7 4 9 4s2.2 1.5 2 3.3" />
      <path d="M17.5 11a2.5 2.5 0 1 0-1.6-4.4" />
      <path d="M16.5 15.7c2.3.3 3.7 1.7 4 4.3" />
    </svg>
  );
}

/** My account. */
export function IconAccount(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5" />
    </svg>
  );
}

/** Log out: door with an arrow. */
export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 4H7a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h6" />
      <path d="M16 8.5 19.5 12 16 15.5M19.5 12H10" />
    </svg>
  );
}

/** Open bills: kitchen cloche. */
export function IconCloche(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16.5a8 8 0 0 1 16 0" />
      <path d="M2.8 16.5h18.4" />
      <path d="M12 8.5V7M11 6.5a1 1 0 1 1 2 0" />
      <path d="M6 19.5h12" />
    </svg>
  );
}

/** Tips / collected: coin. */
export function IconCoins(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M14.5 9.5c-.5-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.6 2.5 1.9c1.5.3 2.5.8 2.5 1.9s-1.1 2-2.5 2c-1 0-2-.4-2.5-1.2" />
    </svg>
  );
}
