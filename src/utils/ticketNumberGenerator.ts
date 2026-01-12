import prisma from '../config/database';

/**
 * Genera un número de ticket único de 6 dígitos (100000-999999)
 * @returns Promise<number> - Número de ticket único
 */
export async function generateUniqueTicketNumber(): Promise<number> {
  const min = 100000;
  const max = 999999;
  const maxAttempts = 100; // Límite de intentos para evitar bucles infinitos
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generar número aleatorio de 6 dígitos
    const ticketNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Verificar si el número ya existe en la base de datos
    const existingTicket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      select: { id: true }
    });
    
    // Si no existe, retornar el número
    if (!existingTicket) {
      return ticketNumber;
    }
    
    // Si existe, continuar con el siguiente intento
    console.warn(`[ticketNumberGenerator] Número de ticket ${ticketNumber} ya existe, generando otro...`);
  }
  
  // Si después de maxAttempts no se encontró un número único, lanzar error
  throw new Error(
    `No se pudo generar un número de ticket único después de ${maxAttempts} intentos. ` +
    `Por favor, contacte al administrador del sistema.`
  );
}

