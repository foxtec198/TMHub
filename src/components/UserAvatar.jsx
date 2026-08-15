import { useEffect, useState } from "react";
import { Avatar } from "primereact/avatar";

import connect from "../utils/request";
import "./UserAvatar.css";

const userDirectory = new Map();
let userDirectoryRequest = null;

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function findCachedUser(id) {
  return Number.isInteger(id) && id > 0 ? userDirectory.get(id) : undefined;
}

async function loadUserDirectory() {
  if (!userDirectoryRequest) {
    userDirectoryRequest = connect.get("/usuarios", { params: { include_photo: 1 } })
      .then(({ data }) => {
        (data || []).forEach((user) => userDirectory.set(Number(user.id), user));
        return userDirectory;
      })
      .catch((error) => {
        userDirectoryRequest = null;
        throw error;
      });
  }

  return userDirectoryRequest;
}

/** Avatar padronizado: usa foto do payload e resolve pelo id quando necessário. */
export function UserAvatar({ user, userId, nome, foto_perfil, style, className, ...props }) {
  const id = Number(user?.id ?? userId);
  const suppliedName = nome ?? user?.nome;
  const [cachedUser, setCachedUser] = useState(() => findCachedUser(id));
  const resolvedUser = cachedUser || findCachedUser(id);
  const displayName = suppliedName ?? resolvedUser?.nome ?? "Usuário";
  const image = foto_perfil ?? user?.foto_perfil ?? resolvedUser?.foto_perfil;

  useEffect(() => {
    let active = true;
    if (image) return undefined;
    const cached = findCachedUser(id);
    if (cached) {
      setCachedUser(cached);
      return undefined;
    }
    if (!Number.isInteger(id) || id <= 0) return undefined;

    loadUserDirectory()
      .then(() => {
        if (active) setCachedUser(findCachedUser(id));
      })
      .catch(() => {
        // As iniciais continuam sendo um fallback visual seguro.
      });

    return () => { active = false; };
  }, [id, image]);

  return (
    <Avatar
      {...props}
      className={`tm-user-avatar ${className || ""}`.trim()}
      image={image || undefined}
      imageAlt={displayName}
      label={image ? undefined : getInitials(displayName)}
      shape="circle"
      style={style}
      title={displayName}
    />
  );
}

export { getInitials };
