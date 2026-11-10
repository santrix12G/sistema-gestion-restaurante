/**
 * Ejecuta en orden las tareas de una misma clave. Si un cliente envía tres mensajes seguidos,
 * se procesan uno tras otro y ninguno pisa el estado de la conversación que dejó el anterior.
 * Funciona dentro de un solo proceso; con varios procesos haría falta una cola externa.
 */
export class ColaPorClave {
  private readonly ultimas = new Map<string, Promise<unknown>>();

  ejecutar<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const anterior = this.ultimas.get(clave) ?? Promise.resolve();
    const actual = anterior.catch(() => undefined).then(tarea);
    this.ultimas.set(clave, actual);
    void actual.finally(() => {
      if (this.ultimas.get(clave) === actual) this.ultimas.delete(clave);
    }).catch(() => undefined);
    return actual;
  }
}
