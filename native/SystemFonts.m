#import <AppKit/AppKit.h>

// Read active font families only. No font files or document text leave the Mac.
int main(void) {
 @autoreleasepool {
  NSFontManager *manager = NSFontManager.sharedFontManager;
  NSMutableArray *families = [NSMutableArray array];
  for (NSString *family in manager.availableFontFamilies) {
   if ([family hasPrefix:@"."]) continue;
   NSString *label = [manager localizedNameForFamily:family face:nil] ?: family;
   // Skip malformed font metadata; one third-party font must not break the list.
   NSDictionary *item = @{@"family":family, @"label":label};
   if (![NSJSONSerialization dataWithJSONObject:item options:0 error:nil]) item = @{@"family":family, @"label":family};
   if ([NSJSONSerialization dataWithJSONObject:item options:0 error:nil]) [families addObject:item];
  }
  NSError *error = nil;
  NSData *json = [NSJSONSerialization dataWithJSONObject:families options:0 error:&error];
  if (!json) { fprintf(stderr, "%s\n", error.localizedDescription.UTF8String); return 1; }
  [[NSFileHandle fileHandleWithStandardOutput] writeData:json];
 }
 return 0;
}
