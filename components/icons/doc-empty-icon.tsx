import { BaseIcon, IconProps } from "./base-icon";

export function DocEmptyIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      {/* Dokument-Umriss */}
      <path d="M20.612,5.484l0,15.142c0,1.426 -1.158,2.584 -2.583,2.584l-12.058,-0c-1.425,-0 -2.583,-1.158 -2.583,-2.584l-0,-17.252c-0,-1.426 1.158,-2.584 2.583,-2.584l10.104,0l4.537,4.694Z" />
      {/* Dokument-Falte */}
      <path d="M16.068,0.79l4.544,4.7l-4.508,-0l-0.036,-4.7Z" />
    </BaseIcon>
  );
}
