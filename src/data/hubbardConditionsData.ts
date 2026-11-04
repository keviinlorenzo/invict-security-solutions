export type HubbardConditionId =
  | 'inexistencia'
  | 'peligro_superior'
  | 'peligro_individuo'
  | 'emergencia'
  | 'normal'
  | 'afluencia'
  | 'afluencia_accion'
  | 'poder'
  | 'cambio_poder';

export interface HubbardConditionFormula {
  id: HubbardConditionId;
  name: string;
  category: 'inexistencia' | 'peligro' | 'emergencia' | 'normal' | 'afluencia' | 'poder';
  badgeTitle: string;
  trendDefinition: string;
  color: string;
  borderLight: string;
  bgDark: string;
  steps: { number: number; title?: string; text: string }[];
  rulesOrAdvice?: string[];
}

export const HUBBARD_CONDITIONS: Record<HubbardConditionId, HubbardConditionFormula> = {
  inexistencia: {
    id: 'inexistencia',
    category: 'inexistencia',
    name: 'Fórmula de Inexistencia',
    badgeTitle: 'Condición de Inexistencia',
    trendDefinition:
      'Aplica cuando una actividad, puesto, cliente o estadística recién comienza, no tiene producción histórica registrada o se encuentra en nivel cero.',
    color: '#94a3b8',
    borderLight: 'border-slate-500/50',
    bgDark: 'bg-slate-900/80',
    steps: [
      {
        number: 1,
        title: 'Encuentre una línea de comunicación',
        text: 'Por línea de comunicación se entiende la ruta por la cual viaja una comunicación de una persona a otra o cualquier secuencia a través de la cual viaja un mensaje de cualquier tipo.',
      },
      {
        number: 2,
        title: 'Dese a conocer',
        text: 'Haga saber al entorno quién es usted, cuál es su función y qué puesto ocupa.',
      },
      {
        number: 3,
        title: 'Descubra lo que se necesita o se desea',
        text: 'Descubra exactamente qué es lo que la empresa, el puesto superior o el cliente necesita o desea realmente.',
      },
      {
        number: 4,
        title: 'Hágalo, prodúzcalo y/o preséntelo',
        text: 'Una persona recién nombrada para un puesto, que se hace cargo de un negocio próspero, a menudo piensa que más le vale darse a conocer cambiando todo aunque a) no es lo suficientemente conocida para hacerlo y b) no tiene ni idea de lo que se necesita o se desea todavía. Y, así, causa estragos. Algunas veces se supone que conoce lo que se necesita o se desea, cuando sólo es una idea fija que tiene, y es sólo una idea suya, y no es verdad en absoluto; y así fracasa en su trabajo.',
      },
    ],
  },

  peligro_superior: {
    id: 'peligro_superior',
    category: 'peligro',
    name: 'Fórmula de Peligro (Para el Superior)',
    badgeTitle: 'Condición de Peligro · Para el Superior',
    trendDefinition:
      'Aplica cuando una estadística cae en picada de manera abrupta o continuada, poniendo en riesgo la estabilidad del área o servicio.',
    color: '#ef4444',
    borderLight: 'border-red-600/70',
    bgDark: 'bg-red-950/80',
    steps: [
      {
        number: 1,
        title: 'Pase por alto al subordinado',
        text: 'Ignore al subordinado o subordinados que normalmente se encargan del área y resuélvalo personalmente.',
      },
      {
        number: 2,
        title: 'Resuelva la situación',
        text: 'Resuelva la situación y cualquier peligro que haya en ella de manera inmediata.',
      },
      {
        number: 3,
        title: 'Asigne Condición de Peligro al Área',
        text: 'Asigne al área en que se tuvo que resolver la situación una Condición de Peligro.',
      },
      {
        number: 4,
        title: 'Asigne Condición de Peligro al Individuo',
        text: 'Asigne a cada individuo relacionado con la condición de peligro una Condición de Peligro para el subordinado, y haga que sigan la fórmula completamente, asegurándose de que lo hagan.',
      },
      {
        number: 5,
        title: 'Reorganice la unidad',
        text: 'Reorganice la unidad para que la situación no se repita.',
      },
      {
        number: 6,
        title: 'Recomiende política firme',
        text: 'Recomiende cualquier política firme que a partir de entonces detecte la condición o impida que se repita.',
      },
    ],
  },

  peligro_individuo: {
    id: 'peligro_individuo',
    category: 'peligro',
    name: 'Fórmula de Peligro (Para el Individuo o Subordinado)',
    badgeTitle: 'Condición de Peligro · Para el Individuo',
    trendDefinition:
      'Aplica al personal o área cuando la estadística ha caído drásticamente y debe corregirse de raíz el modo de operar para evitar que vuelva a suceder.',
    color: '#f87171',
    borderLight: 'border-red-500/60',
    bgDark: 'bg-red-950/60',
    steps: [
      {
        number: 1,
        title: 'Pase por alto hábitos o rutinas normales',
        text: 'Interrumpa de inmediato las rutinas que no están dando resultado.',
      },
      {
        number: 2,
        title: 'Resuelva la situación',
        text: 'Resuelva la situación y cualquier peligro que haya en ella.',
      },
      {
        number: 3,
        title: 'Asígnese una Condición de Peligro',
        text: 'Asumir conscientemente la condición de peligro: evitar que vuelva a suceder.',
      },
      {
        number: 4,
        title: 'Autodisciplina y honestidad',
        text: 'Descubra qué está haciendo que es contrario a los ideales o a los mejores intereses del grupo o actividad y use autodisciplina para corregirlo y vuélvase honesto y recto.',
      },
      {
        number: 5,
        title: 'Reorganice su vida / puesto',
        text: 'Reorganice su vida para que la situación peligrosa no le esté ocurriendo continuamente.',
      },
      {
        number: 6,
        title: 'Formule y adopte política firme',
        text: 'Formule y adopte una política firme que de aquí en adelante detecte la misma situación e impida que vuelva a ocurrir.',
      },
    ],
    rulesOrAdvice: [
      'Nota clave: Es como una decisión para el año nuevo (Las personas que no mantienen esas decisiones, no las mantienen porque no llevaron a cabo los cinco primeros pasos).',
    ],
  },

  emergencia: {
    id: 'emergencia',
    category: 'emergencia',
    name: 'Fórmula de Emergencia',
    badgeTitle: 'Condición de Emergencia',
    trendDefinition:
      'Aplica cuando una estadística no aumenta, se mantiene sin cambio o declina ligeramente.',
    color: '#f59e0b',
    borderLight: 'border-amber-500/70',
    bgDark: 'bg-amber-950/80',
    steps: [
      {
        number: 1,
        title: 'Promocione / Produzca',
        text: 'Promocione. Eso se aplica a una organización. Para un individuo es mejor decir "Produzca". Esa es la primera acción, independientemente de cualquier otra cosa, bueno, eso es lo primero en que tienes que poner atención.',
      },
      {
        number: 2,
        title: 'Cambie su forma de actuar',
        text: 'Si, por ejemplo, te metiste en una condición de emergencia, pero no cambiaste después de que habías promocionado, no hiciste ningún cambio de tu forma de actuar; bien, simplemente te dirigirás a otra condición de emergencia. Así que eso tiene que ser parte de ello; más te vale cambiar tu forma de actuar; tienes que hacer algo para cambiar tu forma de actuar, porque esa forma de actuar te llevó a una emergencia así que más vale cambiarlo.',
      },
      {
        number: 3,
        title: 'Economice',
        text: 'Ajuste los gastos de inmediato y elimine egresos que no aportan directamente a la producción.',
      },
      {
        number: 4,
        title: 'Prepárese para dar el servicio',
        text: 'Asegure la infraestructura y al personal para responder inmediatamente a las nuevas demandas del servicio.',
      },
      {
        number: 5,
        title: 'Haga más estricta la disciplina',
        text: 'Establezca una rigurosidad mayor en el cumplimiento de tareas, horarios y controles operativos.',
      },
    ],
  },

  normal: {
    id: 'normal',
    category: 'normal',
    name: 'Fórmula de Normal',
    badgeTitle: 'Condición de Operación Normal',
    trendDefinition:
      'Aplica cuando la estadística muestra una tendencia de aumento gradual y continuo.',
    color: '#3b82f6',
    borderLight: 'border-blue-500/70',
    bgDark: 'bg-blue-950/80',
    steps: [
      {
        number: 1,
        title: 'No cambiar nada',
        text: 'La manera de mantener un aumento, cuando se encuentra en un estado de funcionamiento normal, es NO CAMBIAR NADA.',
      },
      {
        number: 2,
        title: 'Ética muy poco severa',
        text: 'El factor justicia es bastante ligero y bastante razonable. No se toma ninguna medida brutal en particular.',
      },
      {
        number: 3,
        title: 'Examine la mejora cuidadosamente',
        text: 'Si una estadística mejora, examínela cuidadosamente y averigüe qué la mejoró, y luego haga eso sin abandonar lo que estaba haciendo antes.',
      },
      {
        number: 4,
        title: 'Remedie rápido si empeora ligeramente',
        text: 'Cada vez que una estadística empeore ligeramente, encuentre rápidamente por qué y remédielo. Y simplemente juegas con estos dos factores: la estadística que mejora, la estadística que empeora. Repara la estadística que empeora y encontrarás inevitablemente que se ha hecho algún cambio de esa área donde la estadística empeora; más te vale sacar el cambio de las líneas a la velocidad del rayo. Y cuando encuentras que una estadística está mejorando, más te vale averiguar cómo está mejorando.',
      },
    ],
  },

  afluencia: {
    id: 'afluencia',
    category: 'afluencia',
    name: 'Fórmula de Afluencia',
    badgeTitle: 'Condición de Afluencia (Financiera)',
    trendDefinition:
      'Aplica cuando una estadística financiera o de ingresos tiene una subida pronunciada y empinada hacia arriba.',
    color: '#10b981',
    borderLight: 'border-emerald-500/70',
    bgDark: 'bg-emerald-950/80',
    steps: [
      {
        number: 1,
        title: 'Economice',
        text: 'No comience a derrochar ni a gastar impulsivamente ante la bonanza económica.',
      },
      {
        number: 2,
        title: 'Pague todas sus deudas',
        text: 'Cancele compromisos pendientes, proveedores y obligaciones financieras acumuladas.',
      },
      {
        number: 3,
        title: 'Invierta el resto en mejorar el servicio',
        text: 'Haga que sea más factible entregar; mejore equipamiento, móviles, uniformes y tecnología.',
      },
      {
        number: 4,
        title: 'Descubra qué causó la Afluencia y refuércelo',
        text: 'Investigue con precisión qué acción concreta generó el pico de afluencia y continúe aplicándola sistemáticamente.',
      },
    ],
  },

  afluencia_accion: {
    id: 'afluencia_accion',
    category: 'afluencia',
    name: 'Fórmula de Afluencia de Acción',
    badgeTitle: 'Condición de Afluencia · De Acción / Operativa',
    trendDefinition:
      'Cuando hay una afluencia basada en una estadística que mide las acciones propias y que no está relacionada con las finanzas (ej: tareas realizadas, horas de custodia, efectividad).',
    color: '#059669',
    borderLight: 'border-emerald-600/70',
    bgDark: 'bg-emerald-950/90',
    steps: [
      {
        number: 1,
        title: 'Economiza en acciones dispersas o innecesarias',
        text: 'Economiza en acciones dispersas o innecesarias que no contribuyeron a la condición actual. Economiza financieramente eliminando todo derroche.',
      },
      {
        number: 2,
        title: 'Haz que toda acción cuente',
        text: 'Haz que toda acción cuente y no tomes parte en ninguna acción inútil. Cada nueva acción debe contribuir y ser del mismo tipo que la que sí contribuyó.',
      },
      {
        number: 3,
        title: 'Consolida todas las ganancias',
        text: 'En cualquier área en que hayamos obtenido una ganancia, la conservamos. No dejes que las cosas se relajen o decaigan o hagan montaña rusa. Cualquier ventaja o ganancia que tengamos, la conservamos, la mantenemos.',
      },
      {
        number: 4,
        title: 'Descubre qué causó la afluencia y refuérzalo',
        text: 'Descubre por ti mismo y para ti mismo qué fue lo que causó la condición de Afluencia en tu área inmediata y refuérzalo.',
      },
    ],
    rulesOrAdvice: [
      'El logro de la Afluencia consiste en: 1. Trabajo duro · 2. Ser ético · 3. Aplicación estándar de la tecnología correcta para su actividad · 4. Hacer las cosas que tuvieron éxito, no cosas nuevas que todavía no se han probado · 5. Aplicar la fórmula de la condición en que uno se encuentra.',
    ],
  },

  poder: {
    id: 'poder',
    category: 'poder',
    name: 'Fórmula de Poder',
    badgeTitle: 'Condición de Poder',
    trendDefinition:
      'Aplica cuando la estadística se ha mantenido en una condición de afluencia tan prolongada que se consolida en un nivel altísimo de estabilidad y control.',
    color: '#8b5cf6',
    borderLight: 'border-purple-500/70',
    bgDark: 'bg-purple-950/80',
    steps: [
      {
        number: 1,
        title: 'No desconectarse',
        text: 'La primera ley de una condición de poder es NO DESCONECTARSE.',
      },
      {
        number: 2,
        title: 'Registro de todas las líneas de comunicación',
        text: 'Lo primero que tiene que hacer es elaborar un registro de todas las líneas de comunicación de su trabajo.',
      },
      {
        number: 3,
        title: 'Redactar en detalle todas las funciones',
        text: 'La responsabilidad es redactar en detalle todas las funciones y ponerlas en manos de la persona que se va a hacer cargo del puesto.',
      },
      {
        number: 4,
        title: 'Hacer que el puesto se pueda ocupar',
        text: 'Haga todo lo posible para hacer que el trabajo o el puesto se pueda ocupar.',
      },
    ],
  },

  cambio_poder: {
    id: 'cambio_poder',
    category: 'poder',
    name: 'Fórmula de Cambio de Poder',
    badgeTitle: 'Condición de Cambio de Poder',
    trendDefinition:
      'Aplica cuando un nuevo directivo o colaborador asume un puesto que ha estado funcionando en condición de poder.',
    color: '#a855f7',
    borderLight: 'border-purple-600/70',
    bgDark: 'bg-purple-950/90',
    steps: [
      {
        number: 1,
        title: 'No cambies nada hasta familiarizarte',
        text: 'Cuando asumas un nuevo puesto no cambies nada hasta que te hayas familiarizado totalmente con tu nueva zona de poder.',
      },
    ],
  },
};

/**
 * Función que determina automáticamente la Condición Operativa Hubbard
 * basándose en la tendencia de una serie de datos numéricos.
 */
export function determineHubbardCondition(values: number[]): {
  condition: HubbardConditionFormula;
  slopePercentage: number;
  label: string;
} {
  if (!values || values.length === 0) {
    return {
      condition: HUBBARD_CONDITIONS.inexistencia,
      slopePercentage: 0,
      label: 'Sin registros históricos suficientes',
    };
  }

  // Filtrar ceros iniciales
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0 || valid.every((v) => v === 0)) {
    return {
      condition: HUBBARD_CONDITIONS.inexistencia,
      slopePercentage: 0,
      label: 'Actividad en Inexistencia (Valor Cero)',
    };
  }

  if (valid.length === 1) {
    return {
      condition: HUBBARD_CONDITIONS.normal,
      slopePercentage: 0,
      label: 'Línea de base establecida',
    };
  }

  // Tomar los últimos dos puntos para la tendencia inmediata y los últimos 4 para tendencia media
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];

  let slope = 0;
  if (prev > 0) {
    slope = Math.round(((last - prev) / prev) * 100);
  } else if (last > 0) {
    slope = 100;
  }

  // Comprobar si ha mantenido un nivel elevado durante 4 o más períodos consecutivos
  const recent4 = valid.slice(-4);
  const isSustainedHigh =
    recent4.length >= 4 &&
    recent4.every((v) => v >= 85) &&
    slope >= -2;

  if (isSustainedHigh) {
    return {
      condition: HUBBARD_CONDITIONS.poder,
      slopePercentage: slope,
      label: `Consolidación de Poder (Nivel Sostenido: ${last})`,
    };
  }

  if (slope > 18) {
    return {
      condition: HUBBARD_CONDITIONS.afluencia,
      slopePercentage: slope,
      label: `Tendencia en Afluencia (+${slope}%)`,
    };
  } else if (slope >= 2 && slope <= 18) {
    return {
      condition: HUBBARD_CONDITIONS.normal,
      slopePercentage: slope,
      label: `Tendencia de Aumento Normal (+${slope}%)`,
    };
  } else if (slope < 2 && slope >= -10) {
    return {
      condition: HUBBARD_CONDITIONS.emergencia,
      slopePercentage: slope,
      label: `Tendencia Estancada en Emergencia (${slope}%)`,
    };
  } else {
    return {
      condition: HUBBARD_CONDITIONS.peligro_superior,
      slopePercentage: slope,
      label: `Tendencia Crítica en Peligro (${slope}%)`,
    };
  }
}
