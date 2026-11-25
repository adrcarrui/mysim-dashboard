const dashboardMessages = new Map([
  ["Se requiere el rol editor o admin", "Editor or administrator access is required."],
  ["Briefing no encontrado", "Briefing not found."],
  ["La tarea no está incluida en este briefing", "This task is not included in the briefing."],
  ["La ejecución ha cambiado. Se ha recuperado el estado guardado.", "Task execution changed. The saved state has been restored."],
  ["Ejecutado por debe contener participantes del turno", "Select performers from the shift participants."],
  ["Selecciona un periodo de hasta 366 días", "Select a date range of up to 366 days."],
  ["Selecciona un briefing en borrador para añadir o asignar tareas", "Select a draft briefing to add or assign tasks."],
  ["El responsable debe ser un participante del turno", "The assignee must be a shift participant."],
  ["Hay tareas con ejecución registrada. Vuelve a incluirlas antes de guardar.", "Restore tasks with recorded execution before saving."],
  ["El briefing ha cambiado o ya está finalizado. Actualiza antes de guardar", "The briefing has changed or is already finalised. Refresh before saving."],
  ["El briefing ha cambiado o ya esta finalizado. Actualiza antes de guardar", "The briefing has changed or is already finalised. Refresh before saving."],
  ["Hay participantes duplicados", "Duplicate participants are not allowed."],
  ["Hay trabajos duplicados en el briefing", "Duplicate work items are not allowed."],
  ["Cada responsable debe ser un participante del turno", "Each assignee must be a shift participant."],
  ["La fecha inicial debe ser anterior o igual a la final", "The start date must be on or before the end date."],
  ["El equipo supera el límite de 500 miembros", "The team exceeds the 500-member limit."],
  ["AMH no está configurado", "AMH is not configured."],
  ["AMH no identifico al usuario", "AMH could not identify the user."],
  ["No se pudieron consultar los nombres en AMH", "Could not look up names in AMH."],
  ["AMH no autorizó la consulta de nombres", "AMH rejected the name lookup."],
  ["Falta la ruta briefing-users en AMH; actualiza y reinicia AMH", "The briefing-users route is missing. Update and restart AMH."],
  ["AMH no pudo devolver los nombres del equipo", "AMH could not return the team names."],
  ["AMH devolvió una lista de nombres no válida", "AMH returned an invalid list of names."],
  ["El responsable del móvil no pertenece al equipo activo de mantenimiento", "The phone holder must be an active maintenance team member."],
  ["Algún participante ya no está disponible en el equipo activo de mantenimiento", "A participant is no longer on the active maintenance team."],
  ["Algún responsable ya no está disponible en el equipo activo", "An assignee is no longer on the active team."],
]);

export function briefingErrorMessage(message: string): string {
  return dashboardMessages.get(message) ?? message;
}
