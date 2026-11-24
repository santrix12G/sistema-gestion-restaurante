'use client';

import { NOMBRE_RESTAURANTE } from '@/components/marca';
import { CONTACTO, PaginaPublica } from '@/components/pagina-publica';
import { idiomaActual, t } from '@/lib/i18n';

/**
 * Política de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013).
 * Es un texto base: el negocio debe revisarlo y completarlo con sus datos antes de publicarlo.
 */
export default function Privacidad() {
  const canal = CONTACTO.correo ?? CONTACTO.telefono;
  return (
    <PaginaPublica titulo={t('Política de tratamiento de datos')}>
      {idiomaActual() === 'en' ? (
        <>
          <p>
            {NOMBRE_RESTAURANTE} is responsible for the personal data it collects to take and deliver orders, under Colombian Law 1581 of 2012 and
            Decree 1377 of 2013.
          </p>
          <h2>What data we collect</h2>
          <ul>
            <li>Customers who order through WhatsApp or Telegram: name, phone number or chat identifier, delivery addresses and the messages of the conversation.</li>
            <li>Staff: name, email, role and the actions recorded in the system (orders, payments, cash register).</li>
          </ul>
          <h2>What we use it for</h2>
          <ul>
            <li>To take, prepare, deliver and charge for orders, and to keep the sales history.</li>
            <li>To contact the customer about their order.</li>
            <li>To protect access to the system (sign-in records).</li>
          </ul>
          <p>We do not sell personal data or use it for advertising. Online payments are processed by Mercado Pago, under its own policy.</p>
          <h2>Your rights</h2>
          <p>
            You can know, update, correct and request the deletion of your data, revoke your authorization and file complaints with the Superintendence
            of Industry and Commerce.
            {canal && ` Write to us at ${canal}.`}
          </p>
        </>
      ) : (
        <>
          <p>
            {NOMBRE_RESTAURANTE} es responsable de los datos personales que recoge para tomar y entregar pedidos, según la Ley 1581 de 2012 y el
            Decreto 1377 de 2013.
          </p>
          <h2>Qué datos recogemos</h2>
          <ul>
            <li>De los clientes que piden por WhatsApp o Telegram: nombre, teléfono o identificador del chat, direcciones de entrega y los mensajes de la conversación.</li>
            <li>Del personal: nombre, correo, rol y las acciones que registra en el sistema (pedidos, cobros y caja).</li>
          </ul>
          <h2>Para qué los usamos</h2>
          <ul>
            <li>Para tomar, preparar, entregar y cobrar los pedidos, y llevar el historial de ventas.</li>
            <li>Para contactar al cliente sobre su pedido.</li>
            <li>Para proteger el acceso al sistema (registro de inicios de sesión).</li>
          </ul>
          <p>No vendemos los datos ni los usamos para publicidad. Los pagos en línea los procesa Mercado Pago, con su propia política.</p>
          <h2>Tus derechos</h2>
          <p>
            Puedes conocer, actualizar, rectificar y pedir que se supriman tus datos, revocar la autorización y presentar quejas ante la
            Superintendencia de Industria y Comercio.
            {canal && ` Escríbenos a ${canal}.`}
          </p>
        </>
      )}
    </PaginaPublica>
  );
}
