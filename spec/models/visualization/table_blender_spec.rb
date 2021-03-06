# encoding: utf-8
require_relative '../../spec_helper'
require_relative '../../../app/models/visualization/table_blender'

include CartoDB::Visualization

# TODO this file cannot be executed in isolation
describe TableBlender do
  let(:user) do
    FactoryGirl.create(:valid_user, private_tables_enabled: true, viewer: true)
  end

  let(:map_mock) do
    map = mock
    map.stubs(:to_hash).returns({})
    map.stubs(:user).returns(user)
    map.stubs(:user_layers).returns([])
    map.stubs(:data_layers).returns([])
    map
  end

  describe '#blend' do
    it 'raises an error for viewer users' do
      tables = [fake_public_table, fake_private_table]
      expect {
        TableBlender.new(user, tables).blend
      }.to raise_error(/Viewer users can't blend tables/)
      user.destroy
    end

    describe 'multiple tables' do
      include Carto::Factories::Visualizations
      include_context 'users helper'

      it 'sets increasing order for data layers and keep tiled first and last' do
        map1 = FactoryGirl.create(:carto_map_with_2_tiled_layers, user_id: @carto_user1.id)
        map2 = FactoryGirl.create(:carto_map_with_2_tiled_layers, user_id: @carto_user1.id)
        map1, table1, table_visualization1, visualization1 = create_full_visualization(@carto_user1, canonical_map: map1)
        map2, table2, table_visualization2, visualization2 = create_full_visualization(@carto_user1, canonical_map: map2)

        blender = CartoDB::Visualization::TableBlender.new(@carto_user1, [table1, table2])
        map = blender.blend

        map.layers.count.should eq 4
        orders_and_kind = map.layers.map { |l| [l.order, l.kind] }.sort { |x, y| x[0] <=> y[0] }
        orders_and_kind.should eq [[0, 'tiled'], [1, 'carto'], [2, 'carto'], [3, 'tiled']]

        destroy_full_visualization(map2, table2, table_visualization2, visualization2)
        destroy_full_visualization(map1, table1, table_visualization1, visualization1)
      end
    end
  end

  # TODO test too coupled with implementation outside blender
  # refactor once Privacy is extracted
  describe '#blended_privacy' do
    it 'returns private if any of all tables is private' do
      user   = Object.new
      tables = [fake_public_table, fake_private_table]
      TableBlender.new(user, tables).blended_privacy.should == 'private'

      tables = [fake_private_table, fake_public_table]
      TableBlender.new(user, tables).blended_privacy.should == 'private'
    end

    it 'returns public if all tables are public' do
      user   = Object.new
      tables = [fake_public_table, fake_public_table]

      TableBlender.new(user, tables).blended_privacy.should == 'public'
    end
  end #blended_privacy


  def fake_public_table
    table = mock
    table.stubs(:private?).returns(false)
    table.stubs(:public_with_link_only?).returns(false)
    table.stubs(:map).returns(map_mock)
    table
  end

  def fake_private_table
    table = mock
    table.stubs(:private?).returns(true)
    table.stubs(:public_with_link_only?).returns(false)
    table.stubs(:map).returns(map_mock)
    table
  end
end
