#import <AppKit/AppKit.h>
#include <node_api.h>
#include <string>

// Clip only the official Codex mark at display time; keep its source asset intact.
static NSImage *CodexMark(NSImage *source) {
 if(!source)return nil;
 return [NSImage imageWithSize:NSMakeSize(24,24) flipped:NO drawingHandler:^BOOL(NSRect rect){
  auto point=[](CGFloat x,CGFloat y){return NSMakePoint((x-190)*24/640,(830-y)*24/640);};
  NSBezierPath *mask=[NSBezierPath bezierPath];[mask moveToPoint:point(469,210)];
  [mask curveToPoint:point(581,253) controlPoint1:point(391,190) controlPoint2:point(512,190)];
  [mask curveToPoint:point(775,441) controlPoint1:point(678,225) controlPoint2:point(786,313)];
  [mask curveToPoint:point(698,699) controlPoint1:point(854,545) controlPoint2:point(821,660)];
  [mask curveToPoint:point(443,770) controlPoint1:point(672,812) controlPoint2:point(540,851)];
  [mask curveToPoint:point(254,580) controlPoint1:point(326,803) controlPoint2:point(226,716)];
  [mask curveToPoint:point(325,324) controlPoint1:point(165,488) controlPoint2:point(204,363)];
  [mask curveToPoint:point(469,210) controlPoint1:point(340,257) controlPoint2:point(391,208)];
  [mask closePath];[mask addClip];[source drawInRect:NSMakeRect(-190*24.0/640,-194*24.0/640,1024*24.0/640,1024*24.0/640) fromRect:NSZeroRect operation:NSCompositingOperationSourceOver fraction:1];return YES;
 }];
}

// AppKit owns navigation and its material. Chromium keeps the existing editor/storage.
static napi_threadsafe_function callback;
static void Send(NSDictionary *message) {
 if (!callback) return;
 NSData *data=[NSJSONSerialization dataWithJSONObject:message options:0 error:nil];
 char *copy=strdup([[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding].UTF8String);
 if(napi_call_threadsafe_function(callback,copy,napi_tsfn_nonblocking)!=napi_ok)free(copy);
}
// Public AppKit glass tints explicitly; automatic toolbar segments ignore bezel colors on macOS 26.
@interface JHNavigation : NSControl
@property(nonatomic) NSInteger selectedSegment;
@property(nonatomic,strong) NSArray<NSButton *> *buttons;
@property(nonatomic,strong) NSGlassEffectView *selection;
- (void)setEnabled:(BOOL)enabled forSegment:(NSInteger)segment;
- (void)setPromptEnabled:(BOOL)enabled;
@end
@implementation JHNavigation
- (NSSize)intrinsicContentSize {return NSMakeSize(self.buttons.count&&self.buttons[3].hidden?282:360,32);}
- (instancetype)initWithFrame:(NSRect)frame {
 if((self=[super initWithFrame:frame])){
  self.selection=[[NSGlassEffectView alloc] initWithFrame:NSMakeRect(0,1,76,30)];self.selection.cornerRadius=15;self.selection.tintColor=NSColor.controlAccentColor;[self addSubview:self.selection];
  NSArray *titles=@[@"剧本库",@"文稿",@"分场",@"Prompt",@"预览"];NSMutableArray *buttons=[NSMutableArray array];CGFloat x=0;
  for(NSInteger i=0;i<5;i++){CGFloat width=(i==0||i==3)?78:68;NSButton *b=[NSButton buttonWithTitle:titles[i] target:self action:@selector(choose:)];b.tag=i;b.bordered=NO;b.font=[NSFont systemFontOfSize:12 weight:NSFontWeightMedium];b.frame=NSMakeRect(x,0,width,32);[b setAccessibilityRole:NSAccessibilityRadioButtonRole];[self addSubview:b];[buttons addObject:b];x+=width;}self.buttons=buttons;[self setSelectedSegment:0];
  [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(refreshColors:) name:NSSystemColorsDidChangeNotification object:nil];
 }return self;
}
- (void)dealloc {[[NSNotificationCenter defaultCenter] removeObserver:self];}
- (void)refreshColors:(NSNotification *)note {self.selection.tintColor=NSColor.controlAccentColor;[self setSelectedSegment:_selectedSegment];}
- (void)viewDidChangeEffectiveAppearance {[super viewDidChangeEffectiveAppearance];[self refreshColors:nil];}
- (void)setSelectedSegment:(NSInteger)selected {
 BOOL changed=_selectedSegment!=selected;_selectedSegment=selected;if(selected<0||selected>=self.buttons.count)return;
 NSRect frame=self.buttons[selected].frame;frame=NSInsetRect(frame,2,1);
 if(changed&&self.window&&!NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion){[NSAnimationContext runAnimationGroup:^(NSAnimationContext *context){context.duration=.18;self.selection.animator.frame=frame;} completionHandler:nil];}else self.selection.frame=frame;
 NSColor *accent=[NSColor.controlAccentColor colorUsingColorSpace:NSColorSpace.sRGBColorSpace];CGFloat luminance=.2126*accent.redComponent+.7152*accent.greenComponent+.0722*accent.blueComponent;
 for(NSButton *b in self.buttons){b.contentTintColor=b.tag==selected?(luminance>.65?NSColor.blackColor:NSColor.whiteColor):NSColor.labelColor;[b setAccessibilityValue:@(b.tag==selected)];}
 self.selection.tintColor=NSColor.controlAccentColor;
}
- (void)setEnabled:(BOOL)enabled forSegment:(NSInteger)segment {self.buttons[segment].enabled=enabled;}
- (void)setPromptEnabled:(BOOL)enabled {
 if(self.buttons[3].hidden==!enabled)return;
 self.buttons[3].hidden=!enabled;CGFloat x=0;
 for(NSButton *button in self.buttons){if(button.hidden)continue;NSRect frame=button.frame;frame.origin.x=x;button.frame=frame;x+=frame.size.width;}
 for(NSLayoutConstraint *constraint in self.constraints)if(constraint.firstAttribute==NSLayoutAttributeWidth&&constraint.secondItem==nil)constraint.constant=x;
 [self invalidateIntrinsicContentSize];if(self.buttons[self.selectedSegment].hidden)_selectedSegment=1;[self setSelectedSegment:self.selectedSegment];
}
- (void)choose:(NSButton *)button {if(button.hidden)return;self.selectedSegment=button.tag;[self sendAction:self.action to:self.target];}
@end
@interface JHSidebarButton : NSButton
@property(nonatomic,strong) NSTrackingArea *hoverArea;
@property BOOL hovered;
- (void)updateHover:(BOOL)value;
@end
@implementation JHSidebarButton
- (void)updateTrackingAreas {[super updateTrackingAreas];if(self.hoverArea)[self removeTrackingArea:self.hoverArea];self.hoverArea=[[NSTrackingArea alloc] initWithRect:NSZeroRect options:NSTrackingMouseEnteredAndExited|NSTrackingActiveInKeyWindow|NSTrackingInVisibleRect owner:self userInfo:nil];[self addTrackingArea:self.hoverArea];}
- (void)updateHover:(BOOL)value {self.hovered=value;self.contentTintColor=value?NSColor.controlAccentColor:NSColor.secondaryLabelColor;self.needsDisplay=YES;}
- (void)mouseEntered:(NSEvent *)event {[self updateHover:YES];}
- (void)mouseExited:(NSEvent *)event {[self updateHover:NO];}
- (void)drawRect:(NSRect)rect {if(self.hovered&&self.enabled){[[NSColor.controlAccentColor colorWithAlphaComponent:.12] setFill];[[NSBezierPath bezierPathWithRoundedRect:self.bounds xRadius:7 yRadius:7] fill];}[super drawRect:rect];}
@end
@interface JHOutline : NSOutlineView
@end
@implementation JHOutline
- (BOOL)acceptsFirstResponder { return YES; }
@end
@interface JHShell : NSObject<NSToolbarDelegate,NSOutlineViewDataSource,NSOutlineViewDelegate,NSMenuDelegate,NSSearchFieldDelegate>
@property(nonatomic,weak) NSWindow *window;
@property(nonatomic,strong) NSToolbar *toolbar;
@property(nonatomic,strong) JHNavigation *segments;
@property(nonatomic,strong) NSGlassEffectView *glass;
@property(nonatomic,strong) JHOutline *outline;
@property(nonatomic,strong) NSSearchField *search;
@property(nonatomic,strong) NSView *agentRow;
@property(nonatomic,strong) NSArray *groups;
@property(nonatomic,strong) NSDictionary *state;
@property(nonatomic,strong) NSMutableSet *collapsed;
@property(nonatomic,strong) NSArray *buttons;
@property(nonatomic) BOOL updating;
- (void)install:(NSWindow *)window;
- (void)update:(NSDictionary *)state;
- (CGFloat)toolbarInset;
@end
static JHShell *shell;
@implementation JHShell
- (void)install:(NSWindow *)window {
 self.window=window;self.groups=@[];self.state=@{};self.collapsed=[NSMutableSet set];
 window.styleMask&=~NSWindowStyleMaskFullSizeContentView;window.titlebarAppearsTransparent=YES;window.titlebarSeparatorStyle=NSTitlebarSeparatorStyleNone;window.titleVisibility=NSWindowTitleVisible;window.toolbarStyle=NSWindowToolbarStyleUnified;
 self.toolbar=[[NSToolbar alloc] initWithIdentifier:@"JuhaoNativeToolbar"];self.toolbar.delegate=self;self.toolbar.displayMode=NSToolbarDisplayModeIconOnly;self.toolbar.allowsUserCustomization=NO;self.toolbar.centeredItemIdentifiers=[NSSet setWithObject:@"workspaces"];window.toolbar=self.toolbar;window.titlebarSeparatorStyle=NSTitlebarSeparatorStyleNone;[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(windowResized:) name:NSWindowDidResizeNotification object:window];
 NSView *host=window.contentView;
 self.glass=[[NSGlassEffectView alloc] initWithFrame:NSMakeRect(10,10,220,MAX(100,host.bounds.size.height-20))];self.glass.cornerRadius=18;self.glass.style=NSGlassEffectViewStyleRegular;self.glass.autoresizingMask=NSViewHeightSizable;
 NSView *content=[[NSView alloc] initWithFrame:self.glass.bounds];content.autoresizingMask=NSViewWidthSizable|NSViewHeightSizable;self.glass.contentView=content;
 NSTextField *heading=[NSTextField labelWithString:@"目录"];heading.font=[NSFont boldSystemFontOfSize:14];heading.frame=NSMakeRect(16,content.bounds.size.height-35,90,22);heading.autoresizingMask=NSViewMinYMargin;[content addSubview:heading];
 self.agentRow=[[NSView alloc] initWithFrame:NSMakeRect(126,content.bounds.size.height-36,80,24)];self.agentRow.autoresizingMask=NSViewMinYMargin;[content addSubview:self.agentRow];
 self.search=[[NSSearchField alloc] initWithFrame:NSMakeRect(12,content.bounds.size.height-76,196,28)];self.search.placeholderString=@"搜索场景或文稿";self.search.autoresizingMask=NSViewMinYMargin;self.search.delegate=self;[content addSubview:self.search];
 NSScrollView *scroll=[[NSScrollView alloc] initWithFrame:NSMakeRect(6,225,208,MAX(100,content.bounds.size.height-310))];scroll.autoresizingMask=NSViewHeightSizable;scroll.drawsBackground=NO;scroll.hasVerticalScroller=YES;scroll.autohidesScrollers=YES;
 self.outline=[[JHOutline alloc] initWithFrame:scroll.bounds];NSTableColumn *column=[[NSTableColumn alloc] initWithIdentifier:@"scene"];column.width=200;[self.outline addTableColumn:column];self.outline.outlineTableColumn=column;self.outline.headerView=nil;self.outline.backgroundColor=NSColor.clearColor;self.outline.style=NSTableViewStyleSourceList;self.outline.backgroundColor=NSColor.clearColor;self.outline.rowSizeStyle=NSTableViewRowSizeStyleCustom;self.outline.delegate=self;self.outline.dataSource=self;self.outline.target=self;self.outline.action=@selector(locateScene:);self.outline.doubleAction=@selector(activateScene:);self.outline.indentationPerLevel=10;
 [self.outline registerForDraggedTypes:@[@"studio.changjing.scene"]];[self.outline setDraggingSourceOperationMask:NSDragOperationMove forLocal:YES];
 NSMenu *menu=[[NSMenu alloc] initWithTitle:@"场景"];menu.delegate=self;self.outline.menu=menu;scroll.documentView=self.outline;[content addSubview:scroll];
 NSArray *labels=@[@"添加场景",@"剧本资料",@"幕管理",@"场景隐藏区",@"版本记录",@"设置"];
 NSArray *actions=@[@"add",@"characters",@"acts",@"trash",@"versions",@"settings"];
 NSArray *icons=@[@"plus",@"person.2",@"book",@"eye.slash",@"clock.arrow.circlepath",@"slider.horizontal.3"];
 NSMutableArray *buttons=[NSMutableArray array];for(NSUInteger i=0;i<labels.count;i++){NSButton *button=[JHSidebarButton buttonWithTitle:labels[i] target:self action:@selector(sideAction:)];button.identifier=actions[i];button.image=[NSImage imageWithSystemSymbolName:icons[i] accessibilityDescription:labels[i]];button.imagePosition=NSImageLeading;button.bordered=NO;button.font=[NSFont systemFontOfSize:12 weight:NSFontWeightRegular];button.contentTintColor=NSColor.secondaryLabelColor;button.symbolConfiguration=[NSImageSymbolConfiguration configurationWithPointSize:14 weight:NSFontWeightRegular];button.alignment=NSTextAlignmentLeft;button.frame=NSMakeRect(18,185-i*33,184,28);[content addSubview:button];[buttons addObject:button];}self.buttons=buttons;
 [host addSubview:self.glass positioned:NSWindowAbove relativeTo:nil];self.glass.hidden=YES;[self windowResized:nil];
}
- (void)dealloc {[[NSNotificationCenter defaultCenter] removeObserver:self];}
- (CGFloat)toolbarInset {return MAX(0,NSHeight(self.window.contentView.bounds)-NSMaxY(self.window.contentLayoutRect));}
- (void)windowResized:(NSNotification *)note {CGFloat inset=[self toolbarInset];NSRect frame=self.glass.frame;frame.size.height=MAX(100,NSHeight(self.window.contentView.bounds)-inset-20);self.glass.frame=frame;
 Send(@{@"action":@"toolbar-inset",@"value":[NSString stringWithFormat:@"%.0f",inset]});}
- (NSArray *)toolbarDefaultItemIdentifiers:(NSToolbar *)toolbar {return @[@"sidebar",NSToolbarFlexibleSpaceItemIdentifier,@"workspaces",NSToolbarFlexibleSpaceItemIdentifier,@"export",@"profile",@"settings"];}
- (NSArray *)toolbarAllowedItemIdentifiers:(NSToolbar *)toolbar {return [[self toolbarDefaultItemIdentifiers:toolbar] arrayByAddingObject:@"writing"];}
- (NSToolbarItem *)toolbar:(NSToolbar *)toolbar itemForItemIdentifier:(NSString *)identifier willBeInsertedIntoToolbar:(BOOL)flag {
 if([identifier isEqual:@"writing"]){
  NSMenuToolbarItem *item=[[NSMenuToolbarItem alloc] initWithItemIdentifier:identifier];item.label=@"写作工具";item.title=@"写作工具";item.toolTip=@"写作工具";item.bordered=YES;item.autovalidates=NO;
  NSMenu *menu=[[NSMenu alloc] initWithTitle:item.label];menu.autoenablesItems=NO;
  NSArray *labels=@[@"文稿字体",@"专注写作",@"场景笔记"];NSArray *actions=@[@"font",@"focus",@"notes"];
  for(NSUInteger i=0;i<labels.count;i++){NSMenuItem *entry=[[NSMenuItem alloc] initWithTitle:labels[i] action:@selector(writingAction:) keyEquivalent:@""];entry.target=self;entry.representedObject=actions[i];[menu addItem:entry];}item.menu=menu;return item;
 }
 NSToolbarItem *item=[[NSToolbarItem alloc] initWithItemIdentifier:identifier];item.autovalidates=NO;
 if([identifier isEqual:@"workspaces"]){
  self.segments=[[JHNavigation alloc] initWithFrame:NSMakeRect(0,0,360,32)];self.segments.target=self;self.segments.action=@selector(navigate:);item.view=self.segments;[self.segments.widthAnchor constraintEqualToConstant:360].active=YES;[self.segments.heightAnchor constraintEqualToConstant:32].active=YES;item.visibilityPriority=NSToolbarItemVisibilityPriorityHigh;item.label=@"工作区";item.bordered=NO;return item;
 }
 NSDictionary *labels=@{@"sidebar":@"目录",@"cloud":@"iCloud",@"export":@"导出",@"profile":@"我的名字",@"settings":@"设置"};NSDictionary *images=@{@"sidebar":@"sidebar.left",@"cloud":@"icloud",@"export":@"square.and.arrow.up",@"profile":@"person.crop.circle",@"settings":@"slider.horizontal.3"};
 item.label=labels[identifier]?:identifier;item.toolTip=item.label;item.image=[NSImage imageWithSystemSymbolName:images[identifier] accessibilityDescription:item.label];item.target=self;item.action=@selector(toolbarAction:);item.bordered=YES;return item;
}
- (void)navigate:(id)sender {NSArray *names=@[@"library",@"write",@"board",@"prompts",@"preview"];NSInteger i=self.segments.selectedSegment;if(i>=0&&i<5&&!self.segments.buttons[i].hidden)Send(@{@"action":@"view",@"value":names[i]});}
- (void)toolbarAction:(NSToolbarItem *)item {Send(@{@"action":item.itemIdentifier});}
- (void)writingAction:(NSMenuItem *)item {Send(@{@"action":item.representedObject});}
- (void)sideAction:(NSButton *)button {Send(@{@"action":button.identifier});}
- (void)controlTextDidChange:(NSNotification *)note {Send(@{@"action":@"query",@"value":self.search.stringValue});}
- (NSInteger)outlineView:(NSOutlineView *)view numberOfChildrenOfItem:(id)item {return item?[item[@"children"] count]:self.groups.count;}
- (id)outlineView:(NSOutlineView *)view child:(NSInteger)index ofItem:(id)item {return item?item[@"children"][index]:self.groups[index];}
- (BOOL)outlineView:(NSOutlineView *)view isItemExpandable:(id)item {return item[@"children"]!=nil;}
- (CGFloat)outlineView:(NSOutlineView *)view heightOfRowByItem:(id)item {return item[@"children"]?36:54;}
- (NSView *)outlineView:(NSOutlineView *)view viewForTableColumn:(NSTableColumn *)column item:(id)item {
 NSTableCellView *cell=[[NSTableCellView alloc] initWithFrame:NSMakeRect(0,0,185,item[@"children"]?36:54)];
 NSTextField *text=[NSTextField labelWithString:item[@"name"]?:@"场景"];text.font=item[@"children"]?[NSFont boldSystemFontOfSize:12]:[NSFont systemFontOfSize:12];text.lineBreakMode=NSLineBreakByTruncatingTail;text.frame=NSMakeRect(0,item[@"children"]?8:29,180,18);text.autoresizingMask=NSViewWidthSizable;cell.textField=text;[cell addSubview:text];
 if(!item[@"children"]){NSTextField *detail=[NSTextField labelWithString:item[@"detail"]?:@""];detail.font=[NSFont systemFontOfSize:10];detail.textColor=NSColor.secondaryLabelColor;detail.lineBreakMode=NSLineBreakByTruncatingTail;detail.frame=NSMakeRect(0,9,180,16);detail.autoresizingMask=NSViewWidthSizable;[cell addSubview:detail];}return cell;
}
- (BOOL)outlineView:(NSOutlineView *)view shouldSelectItem:(id)item {return !item[@"children"];}
- (void)outlineViewSelectionDidChange:(NSNotification *)note {if(self.updating)return;id item=[self.outline itemAtRow:self.outline.selectedRow];if(item&&!item[@"children"])Send(@{@"action":@"select-scene",@"id":item[@"id"]});}
- (void)outlineViewItemDidCollapse:(NSNotification *)note {if(!self.updating)[self.collapsed addObject:note.userInfo[@"NSObject"][@"id"]];}
- (void)outlineViewItemDidExpand:(NSNotification *)note {if(!self.updating)[self.collapsed removeObject:note.userInfo[@"NSObject"][@"id"]];}
- (void)locateScene:(id)sender {
 NSInteger row=self.outline.clickedRow;
 if(self.updating||row<0)return;
 NSDictionary *item=[self.outline itemAtRow:row];
 if(item&&!item[@"children"])Send(@{@"action":@"scene",@"id":item[@"id"]});
}
- (void)activateScene:(id)sender {
 NSInteger row=self.outline.clickedRow;
 if(row<0)return;
 NSDictionary *item=[self.outline itemAtRow:row];
 if(!item||item[@"children"])return;
 NSTableCellView *cell=[self.outline viewAtColumn:0 row:row makeIfNecessary:NO];
 NSTextField *label=cell.textField;
 BOOL rename=NO;
 if(label&&![self.state[@"readonly"] boolValue]){
  NSRect textRect=[label.cell titleRectForBounds:label.bounds];
  NSString *value=label.stringValue;
  NSRange split=[value rangeOfString:@"  "];
  if(split.location!=NSNotFound){
   NSDictionary *attrs=@{NSFontAttributeName:label.font};
   CGFloat prefix=[[value substringToIndex:NSMaxRange(split)] sizeWithAttributes:attrs].width;
   CGFloat width=MIN([value sizeWithAttributes:attrs].width,NSWidth(textRect));
   NSRect title=NSMakeRect(NSMinX(textRect)+prefix,NSMinY(textRect),MAX(0,width-prefix),NSHeight(textRect));
   rename=NSPointInRect([label convertPoint:NSApp.currentEvent.locationInWindow fromView:nil],title);
  }
 }
 Send(@{@"action":rename?@"rename":@"scene",@"id":item[@"id"]});
}
- (void)menuNeedsUpdate:(NSMenu *)menu {[menu removeAllItems];id item=[self.outline itemAtRow:self.outline.clickedRow];if(!item||item[@"children"]||[self.state[@"readonly"] boolValue])return;NSArray *names=@[@"重命名",@"隐藏",@"删除"],*actions=@[@"rename",@"hide",@"delete"];for(NSUInteger i=0;i<3;i++){NSMenuItem *m=[[NSMenuItem alloc] initWithTitle:names[i] action:@selector(contextAction:) keyEquivalent:@""];m.target=self;m.representedObject=@{@"action":actions[i],@"id":item[@"id"]};[menu addItem:m];}}
- (void)contextAction:(NSMenuItem *)item {Send(item.representedObject);}
- (id<NSPasteboardWriting>)outlineView:(NSOutlineView *)view pasteboardWriterForItem:(id)item {if(item[@"children"]||[self.state[@"readonly"] boolValue])return nil;NSPasteboardItem *p=[NSPasteboardItem new];[p setString:item[@"id"] forType:@"studio.changjing.scene"];return p;}
- (NSDragOperation)outlineView:(NSOutlineView *)view validateDrop:(id<NSDraggingInfo>)info proposedItem:(id)item proposedChildIndex:(NSInteger)index {return item[@"children"]&&![self.state[@"readonly"] boolValue]?NSDragOperationMove:NSDragOperationNone;}
- (BOOL)outlineView:(NSOutlineView *)view acceptDrop:(id<NSDraggingInfo>)info item:(id)item childIndex:(NSInteger)index {NSString *sid=[info.draggingPasteboard stringForType:@"studio.changjing.scene"];if(!sid||!item[@"children"]||[self.state[@"readonly"] boolValue])return NO;NSArray *children=item[@"children"];Send(@{@"action":@"assign",@"id":sid,@"actId":item[@"id"],@"beforeId":index>=0&&index<children.count?children[index][@"id"]:@""});return YES;}
- (void)update:(NSDictionary *)state {
 self.updating=YES;
 if(![self.state[@"agents"] isEqual:state[@"agents"]]){
  for(NSView *view in [self.agentRow.subviews copy])[view removeFromSuperview];
  NSArray *agents=state[@"agents"]?:@[];self.agentRow.hidden=agents.count==0;NSInteger i=0;
  for(NSDictionary *agent in agents){
   NSButton *button=[NSButton buttonWithTitle:@"" target:self action:@selector(sideAction:)];button.identifier=@"assistant-settings";button.bordered=NO;button.imagePosition=NSImageOnly;button.frame=NSMakeRect(MAX(0,80-agents.count*26)+i*26,0,24,24);
   NSImage *icon=[agent[@"kind"] isEqual:@"other"]?nil:[[NSImage alloc] initWithContentsOfFile:agent[@"icon"]];if([agent[@"kind"] isEqual:@"codex"])icon=CodexMark(icon);button.image=icon?:[NSImage imageWithSystemSymbolName:@"point.3.connected.trianglepath.dotted" accessibilityDescription:@"Agent"];button.imageScaling=NSImageScaleProportionallyUpOrDown;
   button.toolTip=[NSString stringWithFormat:@"%@ 已连接 · %@",agent[@"label"],agent[@"access"]];[button setAccessibilityLabel:button.toolTip];[self.agentRow addSubview:button];
   NSTextField *dot=[NSTextField labelWithString:@"●"];dot.font=[NSFont systemFontOfSize:8];dot.textColor=NSColor.systemGreenColor;dot.frame=NSMakeRect(NSMaxX(button.frame)-5,0,8,10);[self.agentRow addSubview:dot];i++;
  }
 }
 BOOL activeChanged=![self.state[@"active"] isEqual:state[@"active"]];
 BOOL projectChanged=![self.state[@"projectId"] isEqual:state[@"projectId"]];if(projectChanged){[self.collapsed removeAllObjects];self.search.stringValue=@"";}
 NSString *theme=state[@"theme"];if(![self.state[@"theme"] isEqual:theme])self.window.appearance=[theme isEqual:@"dark"]?[NSAppearance appearanceNamed:NSAppearanceNameDarkAqua]:[theme isEqual:@"light"]?[NSAppearance appearanceNamed:NSAppearanceNameAqua]:nil;self.state=state;self.window.title=state[@"title"]?:@"剧好写";self.window.subtitle=state[@"status"]?:@"";
 [self.segments setPromptEnabled:state[@"promptEnabled"]==nil||[state[@"promptEnabled"] boolValue]];
 NSArray *views=@[@"library",@"write",@"board",@"prompts",@"preview"];NSUInteger selected=[views indexOfObject:state[@"view"]];self.segments.selectedSegment=selected==NSNotFound?0:selected;
 BOOL writing=[state[@"view"] isEqual:@"write"]&&[state[@"opened"] boolValue];NSInteger writingIndex=-1;
 for(NSUInteger i=0;i<self.toolbar.items.count;i++)if([self.toolbar.items[i].itemIdentifier isEqual:@"writing"])writingIndex=i;
 if(writing&&writingIndex<0)[self.toolbar insertItemWithItemIdentifier:@"writing" atIndex:4];else if(!writing&&writingIndex>=0)[self.toolbar removeItemAtIndex:writingIndex];
 for(NSToolbarItem *item in self.toolbar.items)if([item isKindOfClass:NSMenuToolbarItem.class])for(NSMenuItem *entry in ((NSMenuToolbarItem *)item).menu.itemArray){entry.state=[state[entry.representedObject] boolValue]?NSControlStateValueOn:NSControlStateValueOff;}
 BOOL blocked=[state[@"modal"] boolValue];for(NSInteger i=0;i<5;i++)[self.segments setEnabled:!blocked&&(i==0||[state[@"opened"] boolValue]) forSegment:i];for(NSToolbarItem *item in self.toolbar.items)if(![item.itemIdentifier isEqual:@"workspaces"])item.enabled=!blocked;
 self.glass.hidden=![state[@"sidebar"] boolValue]||blocked;
 for(NSButton *b in self.buttons)b.enabled=!blocked&&(![b.identifier isEqual:@"add"]||![state[@"readonly"] boolValue]);
 if(![self.groups isEqual:state[@"groups"]]){self.groups=state[@"groups"]?:@[];[self.outline reloadData];for(id group in self.groups)if(![self.collapsed containsObject:group[@"id"]])[self.outline expandItem:group];}
 if(activeChanged||projectChanged){
  for(id group in self.groups)for(id child in group[@"children"])if([child[@"id"] isEqual:state[@"active"]]){
   [self.collapsed removeObject:group[@"id"]];[self.outline expandItem:group];break;
  }
 }
 NSInteger row=-1;for(NSInteger i=0;i<self.outline.numberOfRows;i++)if([[[self.outline itemAtRow:i] objectForKey:@"id"] isEqual:state[@"active"]]){row=i;break;}
 if(row>=0){[self.outline selectRowIndexes:[NSIndexSet indexSetWithIndex:row] byExtendingSelection:NO];if(activeChanged||projectChanged)[self.outline scrollRowToVisible:row];}else [self.outline deselectAll:nil];self.updating=NO;
}
@end
static NSString *String(napi_env env,napi_value value){size_t length=0;if(napi_get_value_string_utf8(env,value,nullptr,0,&length)!=napi_ok)return nil;std::string str(length+1,'\0');napi_get_value_string_utf8(env,value,str.data(),str.size(),&length);return [[NSString alloc] initWithBytes:str.data() length:length encoding:NSUTF8StringEncoding];}
static napi_value JSBoolean(napi_env env,bool value){napi_value result;napi_get_boolean(env,value,&result);return result;}
static void Detach(){if(shell){[shell.glass removeFromSuperview];shell.window.toolbar=nil;shell=nil;}if(callback){napi_release_threadsafe_function(callback,napi_tsfn_abort);callback=nullptr;}}
static napi_value Attach(napi_env env,napi_callback_info info){
 if(!NSThread.isMainThread){napi_throw_error(env,nullptr,"AppKit requires main thread");return nullptr;}
 if(@available(macOS 26.0,*)){
  size_t argc=2;napi_value args[2];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);void *data=nullptr;size_t length=0;
  if(argc!=2||napi_get_buffer_info(env,args[0],&data,&length)!=napi_ok||length!=sizeof(void*)){napi_throw_type_error(env,nullptr,"Invalid native window handle");return nullptr;}
  NSView *view=(__bridge NSView *)*(void**)data;NSWindow *window=view.window;if(!window)return JSBoolean(env,false);Detach();napi_value name;napi_create_string_utf8(env,"Juhao AppKit commands",NAPI_AUTO_LENGTH,&name);
  napi_status result=napi_create_threadsafe_function(env,args[1],nullptr,name,0,1,nullptr,nullptr,nullptr,[](napi_env e,napi_value cb,void *,void *message){if(e&&cb){napi_value text,global,unused;napi_create_string_utf8(e,(char*)message,NAPI_AUTO_LENGTH,&text);napi_get_global(e,&global);napi_call_function(e,global,cb,1,&text,&unused);}free(message);},&callback);
  if(result!=napi_ok){napi_throw_error(env,nullptr,"Cannot initialize native command bridge");return nullptr;}
  napi_unref_threadsafe_function(env,callback);shell=[JHShell new];[shell install:window];return JSBoolean(env,true);
 }return JSBoolean(env,false);
}
static napi_value Update(napi_env env,napi_callback_info info){size_t argc=1;napi_value value;napi_get_cb_info(env,info,&argc,&value,nullptr,nullptr);NSString *text=argc?String(env,value):nil;if(!text||text.length>2000000)return JSBoolean(env,false);id state=[NSJSONSerialization JSONObjectWithData:[text dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];if(![state isKindOfClass:NSDictionary.class])return JSBoolean(env,false);[shell update:state];return JSBoolean(env,shell!=nil);}
static napi_value Close(napi_env env,napi_callback_info info){Detach();return JSBoolean(env,true);}
static napi_value Inspect(napi_env env,napi_callback_info info){NSDictionary *state=@{@"windowNumber":@(shell.window.windowNumber),@"attached":@(shell!=nil),@"material":shell?NSStringFromClass(shell.glass.class):@"",@"toolbar":shell?NSStringFromClass(shell.toolbar.class):@"",@"navigationWidth":@(shell.segments.frame.size.width),@"promptVisible":@(!shell.segments.buttons[3].hidden),@"toolbarInset":@([shell toolbarInset]),@"separatorNone":@(shell.window.titlebarSeparatorStyle==NSTitlebarSeparatorStyleNone),@"toolbarItems":[shell.toolbar.items valueForKey:@"itemIdentifier"]?:@[],@"selectionTinted":@(shell.segments.selection.tintColor!=nil),@"sidebarHover":@(((JHSidebarButton *)shell.buttons.lastObject).hovered),@"rows":@(shell.outline.numberOfRows),@"selected":@(shell.segments.selectedSegment),@"sidebarVisible":@(!shell.glass.hidden),@"state":shell.state?:@{}};NSData *data=[NSJSONSerialization dataWithJSONObject:state options:0 error:nil];napi_value result;napi_create_string_utf8(env,(const char*)data.bytes,data.length,&result);return result;}
static napi_value TestAction(napi_env env,napi_callback_info info){if(!getenv("JUHAO_NATIVE_SELF_TEST"))return JSBoolean(env,false);size_t argc=1;napi_value value;napi_get_cb_info(env,info,&argc,&value,nullptr,nullptr);NSString *key=String(env,value);if([key isEqual:@"hover-settings"]){[(JHSidebarButton *)shell.buttons.lastObject updateHover:YES];return JSBoolean(env,true);}if([key isEqual:@"unhover-settings"]){[(JHSidebarButton *)shell.buttons.lastObject updateHover:NO];return JSBoolean(env,true);}if([key isEqual:@"activate"]){[NSApp activateIgnoringOtherApps:YES];[shell.window makeKeyAndOrderFront:nil];return JSBoolean(env,true);}NSArray *views=@[@"library",@"write",@"board",@"prompts",@"preview"];NSUInteger index=[views indexOfObject:key];if(index!=NSNotFound){shell.segments.selectedSegment=index;[shell.segments sendAction:shell.segments.action to:shell.segments.target];}else for(NSToolbarItem *item in shell.toolbar.items){if([item.itemIdentifier isEqual:key])[NSApp sendAction:item.action to:item.target from:item];if([item isKindOfClass:NSMenuToolbarItem.class])for(NSMenuItem *entry in ((NSMenuToolbarItem *)item).menu.itemArray)if([entry.representedObject isEqual:key])[NSApp sendAction:entry.action to:entry.target from:entry];}return JSBoolean(env,true);}
NAPI_MODULE_INIT(){struct {const char *name;napi_callback fn;} methods[]={{"attach",Attach},{"update",Update},{"detach",Close},{"inspect",Inspect},{"testAction",TestAction}};for(auto method:methods){napi_value fn;napi_create_function(env,method.name,NAPI_AUTO_LENGTH,method.fn,nullptr,&fn);napi_set_named_property(env,exports,method.name,fn);}napi_add_env_cleanup_hook(env,[](void*){Detach();},nullptr);return exports;}
