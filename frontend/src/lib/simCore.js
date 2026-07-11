// ============================================================================
// simCore.js — Camada genérica e reutilizável de simulação de entidades no mapa
// ============================================================================
//
// Fachada única do motor visual partilhado por TODAS as entidades do mapa
// (equipas do jogador, polícia, futuras entidades: PSP, GNR, brigadas,
// inspetores, helicópteros, etc.). Não duplica código: re-exporta os
// primitivos genéricos que vivem em choreo.js (fonte única de verdade,
// já batalhados pela simulação das missões) e em routing.js.
//
// Pipeline base que qualquer entidade pode especializar:
//   Deslocação → Chegada → Estacionamento → Desembarque → Aproximação
//   → Execução → Retirada → Embarque → Regresso
//
// • Operação criminosa: Execução = assalto, carga, cobrança, infiltração…
// • Polícia:           Execução = avaliação, perímetro, perseguição,
//                       intervenção, pedido de reforços (ver police.js)
//
// O que cada bloco oferece:
//   PRNG        — hashStr/mulberry32: variação procedural determinística
//   Geometria   — offsetM/bearingRad/distMeters/ringPoint: posições em redor
//                 de um alvo, aproximação local em metros
//   Caminhos    — walkPath/polyPath/pathAt/pathHeading: trajetos a pé
//                 orgânicos com rumo por frame
//   Easings     — trapezoidEase (aceleração/cruzeiro/travagem de veículos),
//                 steppedEase/hesitantEase (passadas humanas)
//   Personagens — idleDrift (ninguém fica estátua), lookHeading (varrimento
//                 do olhar), spreadAngles (distribuição pelo perímetro)
//   Veículo     — vehicleTimings/buildParking/vehiclePoseAt: pose por frame
//                 com travagem, encosto à berma e rumo da via, para qualquer
//                 "perna" com {id, origin, target, depart_at, arrive_at,
//                 finish_at, return_at}
//   Rotas       — fetchRoute (OSRM com cache/dedup), pointOnRoute,
//                 buildCumulative, sliceRoute

export {
  // PRNG determinístico
  hashStr, mulberry32,
  // Geometria local (metros)
  clamp, smooth, lerpPt, offsetM, bearingRad, toDeg, distMeters, ringPoint, normAng,
  // Caminhos a pé
  walkPath, polyPath, pathAt, pathHeading,
  // Easings
  trapezoidEase, steppedEase, hesitantEase,
  // Micro-comportamentos de personagens
  idleDrift, lookHeading, spreadAngles,
  // Motor de veículo por timestamps (pernas fechadas)
  vehicleTimings, buildParking, vehiclePoseAt, routeBearingDeg,
} from "./choreo";

export { fetchRoute, buildCumulative, pointOnRoute, sliceRoute } from "./routing";
