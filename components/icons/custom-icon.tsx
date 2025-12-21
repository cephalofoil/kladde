import { BaseIcon, IconProps } from "./base-icon";

export function CustomIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      {/* Hier kommt dein SVG-Pfad rein */}
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </BaseIcon>
  );
}
