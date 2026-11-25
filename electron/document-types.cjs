// Keep the legacy content identifier unchanged: the extension change does not
// rewrite existing documents or invalidate their duplicate-import fingerprints.
module.exports={
 UTExportedTypeDeclarations:[
  {UTTypeIdentifier:'studio.changjing.writer.jhwrite',UTTypeDescription:'剧好写剧本',UTTypeConformsTo:['public.data'],UTTypeTagSpecification:{'public.filename-extension':['jhwrite'],'public.mime-type':'application/x-juhaoxie-jhwrite'}},
  {UTTypeIdentifier:'studio.changjing.writer.drg',UTTypeDescription:'剧好写旧版剧本',UTTypeConformsTo:['public.data'],UTTypeTagSpecification:{'public.filename-extension':['drg'],'public.mime-type':'application/x-juhaoxie-drg'}},
 ],
 CFBundleDocumentTypes:[
  {CFBundleTypeName:'剧好写剧本',CFBundleTypeRole:'Editor',LSHandlerRank:'Default',LSItemContentTypes:['studio.changjing.writer.jhwrite'],CFBundleTypeExtensions:['jhwrite']},
  {CFBundleTypeName:'剧好写旧版剧本',CFBundleTypeRole:'Editor',LSHandlerRank:'Alternate',LSItemContentTypes:['studio.changjing.writer.drg'],CFBundleTypeExtensions:['drg']},
 ],
};
