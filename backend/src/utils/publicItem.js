export function publicItem(item) {
  const plain = { ...item, location: { ...item.location } }
  delete plain.location.coordinates
  if (plain.location.lat !== undefined) plain.location.lat = Number(plain.location.lat.toFixed(2))
  if (plain.location.lng !== undefined) plain.location.lng = Number(plain.location.lng.toFixed(2))
  return plain
}
