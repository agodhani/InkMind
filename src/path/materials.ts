export interface PathMaterialLink { title: string; href: string }
export interface PathMaterials { resources?: readonly PathMaterialLink[]; project?: PathMaterialLink }

export interface PathMaterialsProvider {
  forStep(mapId: string, conceptId: string): PathMaterials | undefined;
  forStage(mapId: string, stageId: string): PathMaterials | undefined;
}
