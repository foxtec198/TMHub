// Componentes
import { UserAvatar } from "./UserAvatar";

// Prioriza a foto do membro e aplica uma cor de fallback no avatar.
export default function ProjectMemberAvatar({ member, style, ...props }) {
  const photo = member?.foto_perfil || null;

  return (
    <UserAvatar
      {...props}
      user={member}
      foto_perfil={photo}
      nome={member?.nome || 'Membro do projeto'}
      style={{
        backgroundColor: member?.avatarColor || '#2f9e44',
        color: '#fff',
        ...style,
      }}
      title={member?.nome}
    />
  );
}
