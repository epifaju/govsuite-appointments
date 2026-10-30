const response =
  $('Préparer réponse disponibilité').item.json;

return [{
  json: {
    type: response.type ?? 'availability',
    title: response.title ?? 'Créneaux disponibles',
    slots: response.slots ?? [],
    availableSlots: response.availableSlots ?? [],
    text: response.text ?? "Voici les créneaux disponibles."
  }
}];